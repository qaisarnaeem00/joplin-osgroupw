import type { Expression, ExpressionBuilder, QueryCreator, SqlBool } from 'kysely';
import time from '../../time';
import { db, compile, DynamicDatabase } from '../database/kysely';
import { ftsMatch, ftsOffsets, ftsMatchInfo } from '../database/sqlite';

interface Term {
	name: string;
	value: string;
	negated: boolean;
}

type Relation = 'AND' | 'OR';
type Condition = (eb: ExpressionBuilder<DynamicDatabase, string>)=> Expression<SqlBool>;
interface Clause {
	relation: Relation;
	condition: Condition;
}

const trimQuotes = (value: string) => value.startsWith('"') && value.endsWith('"') ? value.substr(1, value.length - 2) : value;

const getUnixMs = (date: string): string => {
	if (/^[0-9]{8}$/.test(date)) return time.formatLocalToMs(date, 'YYYYMMDD').toString();
	if (/^[0-9]{6}$/.test(date)) return time.formatLocalToMs(date, 'YYYYMM').toString();
	if (/^[0-9]{4}$/.test(date)) return time.formatLocalToMs(date, 'YYYY').toString();
	const match = /^(day|week|month|year)(\+|-)([0-9]+)$/i.exec(date);
	if (!match) throw new Error('Invalid date format!');
	return match[2] === '+' ? time.goForwardInTime(Date.now(), Number(match[3]), match[1]) : time.goBackInTime(Date.now(), Number(match[3]), match[1]);
};

// Keep SQLite's AND precedence when filters mix mandatory notebook constraints
// with OR terms. Group each AND chain before joining the chains with OR.
const combine = (initial: Condition, clauses: Clause[]): Condition => eb => {
	const groups: Expression<SqlBool>[][] = [[initial(eb)]];
	for (const clause of clauses) {
		if (clause.relation === 'OR') groups.push([]);
		groups[groups.length - 1].push(clause.condition(eb));
	}
	return eb.or(groups.map(group => eb.and(group)));
};

export default function queryBuilder(terms: Term[], useFts: boolean) {
	const any = terms.find(term => term.name === 'any');
	const relation: Relation = any?.value === '1' ? 'OR' : 'AND';
	const table = useFts ? 'notes_fts' : 'notes';
	const target = useFts ? 'notes_normalized' : 'notes';
	const clauses: Clause[] = [];
	// Generated CTE names use the dynamic schema boundary; their selected IDs
	// remain available through the same record interface as dynamic model tables.
	let database: QueryCreator<DynamicDatabase> = db;
	let hasWith = false;
	const add = (condition: Condition, connective: Relation = relation) => clauses.push({ relation: connective, condition });
	const initial: Condition = eb => !terms.some(term => term.name === 'notebook') && relation === 'OR' ? eb('rowid', '=', -1) : eb.val(true);
	const generic = (selected: Term[], field: string) => {
		for (const term of selected) {
			const column = field === 'sourceurl' ? 'source_url' : field === 'date' ? (term.name === 'due' ? 'todo_due' : `user_${term.name}_time`) : term.name;
			const operator = field === 'sourceurl' || field === 'id' ? (term.negated ? 'not like' : 'like') : (term.negated ? '<' : '>=');
			const value = field === 'date' ? getUnixMs(term.value) : term.value;
			const matching = db.selectFrom(target).select('rowid').where(`${target}.${column}`, operator, value);
			add(eb => term.name === 'due' ? eb.and([eb('is_todo', 'is', 1), eb('rowid', 'in', matching)]) : eb('rowid', 'in', matching));
		}
	};

	generic(terms.filter(term => term.name === 'id'), 'id');

	for (const negated of [false, true]) {
		const notebookTerms = terms.filter(term => term.name === 'notebook' && term.negated === negated);
		if (!notebookTerms.length) continue;
		const view: string = negated ? 'notebooks_not_in_scope' : 'notebooks_in_scope';
		database = database.withRecursive(`${view}(id)`, qb => qb.selectFrom('folders').select('folders.id')
			.where(eb => eb.or(notebookTerms.map(term => eb('folders.title', 'like', term.value))))
			.unionAll(qb.selectFrom('folders').innerJoin(view, 'folders.parent_id', `${view}.id`).select('folders.id'))) as unknown as QueryCreator<DynamicDatabase>;
		hasWith = true;
		add(eb => eb('rowid', negated ? 'not in' : 'in', db.selectFrom(view).innerJoin(target, `${view}.id`, `${target}.parent_id`).select(`${target}.rowid`)), 'AND');
	}

	for (const kind of ['tags', 'resources']) {
		for (const negated of [false, true]) {
			const selected = terms.filter(term => term.name === (kind === 'tags' ? 'tag' : 'resource') && term.negated === negated);
			if (!selected.length) continue;
			const association = `note_${kind}`;
			const requirement = negated ? 'EXCLUSION' : 'INCLUSION';
			const name = `notes_with_${requirement}_${kind}`;
			const matching = (value: string) => {
				const ids = db.selectFrom(kind).select('id').where(kind === 'tags' ? 'tags.title' : 'resources.mime', 'like', value);
				let query = db.selectFrom(association).select(`${association}.note_id as id`).where(`${association}.${kind === 'tags' ? 'tag_id' : 'resource_id'}`, 'in', ids);
				if (kind === 'resources') query = query.where('note_resources.is_associated', '=', 1);
				return query;
			};
			const intersect = relation === 'AND' && !negated;
			if (relation === 'OR' && negated) {
				const allName = `all_notes_with_${requirement}_${kind}`;
				database = database.with(allName, () => db.selectFrom(association).select(`${association}.note_id as id`).distinct()) as unknown as QueryCreator<DynamicDatabase>;
				const excluded = (value: string) => db.selectFrom(db.selectFrom(allName).selectAll().except(matching(value)).as('excluded_notes')).selectAll();
				let required = excluded(selected[0].value);
				for (const term of selected.slice(1)) required = required.union(excluded(term.value));
				database = database.with(name, () => required) as unknown as QueryCreator<DynamicDatabase>;
			} else {
				let required = db.selectFrom(association).select(`${association}.note_id as id`).where(eb => eb.val(intersect));
				for (const term of selected) required = intersect ? required.intersect(matching(term.value)) : required.union(matching(term.value));
				database = database.with(name, () => required) as unknown as QueryCreator<DynamicDatabase>;
			}
			hasWith = true;
			add(eb => eb('rowid', relation === 'AND' && negated ? 'not in' : 'in', db.selectFrom(name).innerJoin(target, `${name}.id`, `${target}.id`).select(`${target}.rowid`)));
		}
	}

	const textTerms = terms.filter(term => ['title', 'body', 'text'].includes(term.name));
	const likeMatch = (term: Term) => {
		const pattern = `%${trimQuotes(term.value).replace(/\*/, '%')}%`;
		add(eb => {
			const conditions = [];
			if (term.name === 'text' || term.name === 'body') conditions.push(eb('notes.body', 'like', pattern));
			if (term.name === 'text' || term.name === 'title') conditions.push(eb('notes.title', 'like', pattern));
			const expression = eb.or(conditions);
			return term.negated ? eb.not(expression) : expression;
		});
	};
	const included = textTerms.filter(term => !term.negated);
	if (included.length) {
		if (useFts) {
			const match = included.map(term => term.name === 'text' ? term.value : `${term.name}:${term.value}`).join(relation === 'OR' ? ' OR ' : ' ');
			add(() => ftsMatch('notes_fts', match));
		} else {
			for (const term of included) likeMatch(term);
		}
	}
	for (const name of ['text', 'title', 'body']) {
		const excluded = textTerms.filter(term => term.negated && term.name === name);
		if (!excluded.length) continue;
		if (!useFts) {
			for (const term of excluded) likeMatch(term);
			continue;
		}
		const column = name === 'text' ? 'notes_fts' : `notes_fts.${name}`;
		if (relation === 'AND') {
			const matching = db.selectFrom('notes_fts').select('rowid').where(ftsMatch(column, excluded.map(term => term.value).join(' OR ')));
			add(eb => eb('rowid', 'not in', matching));
		} else {
			for (const term of excluded) {
				const matching = db.selectFrom('notes_fts').select('rowid').where(ftsMatch(column, term.value));
				const remaining = db.selectFrom(db.selectFrom('notes_fts').select('rowid').except(matching).as('remaining_notes')).selectAll();
				add(eb => eb('rowid', 'in', remaining));
			}
		}
	}

	for (const name of ['type', 'iscompleted']) {
		for (const term of terms.filter(term => term.name === name)) {
			const source = useFts && relation === 'OR' ? 'notes_normalized' : table;
			const condition: Condition = eb => name === 'type' ? eb(`${source}.is_todo`, 'is', term.value === 'todo' ? 1 : 0) : eb.and([
				eb(`${source}.is_todo`, 'is', 1), eb(`${source}.todo_completed`, term.value === '1' ? 'is not' : 'is', 0),
			]);
			add(eb => useFts && relation === 'OR' ? eb('rowid', 'in', db.selectFrom('notes_normalized').select('rowid').where(condition)) : condition(eb));
		}
	}
	generic(terms.filter(term => ['created', 'updated', 'due'].includes(term.name)), 'date');
	generic(terms.filter(term => ['latitude', 'longitude', 'altitude'].includes(term.name)), 'location');
	generic(terms.filter(term => term.name === 'sourceurl'), 'sourceurl');

	let builder = database.selectFrom(table).select([
		`${table}.id`, `${table}.title`, `${table}.user_created_time`, `${table}.user_updated_time`,
		`${table}.is_todo`, `${table}.todo_completed`, `${table}.parent_id`,
	]);
	if (useFts) builder = builder.select([ftsOffsets('notes_fts').as('offsets'), ftsMatchInfo('notes_fts').as('matchinfo')]);
	if (hasWith && terms.some(term => term.name === 'notebook') && any) {
		// Keep the established notebook/any grouping and its inner FTS row IDs.
		const remaining = db.selectFrom('notes_fts').select('rowid').where(combine(eb => eb.val(false), clauses.slice(1)));
		builder = builder.where(combine(initial, clauses.slice(0, 1))).where('rowid', 'in', remaining);
	} else {
		builder = builder.where(combine(initial, clauses));
	}
	const compiled = compile(builder);
	return { builder, query: compiled.sql, params: compiled.params };
}
