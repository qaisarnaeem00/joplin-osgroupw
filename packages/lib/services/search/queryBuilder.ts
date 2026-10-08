import type { Expression, SqlBool, QueryCreator, SelectQueryBuilder } from 'kysely';
import { queryBuilder as qb, compileQuery, sql, eb } from '../database/kysely';
import time from '../../time';

interface Term { name: string; value: string; negated: boolean }
type Relation = 'AND' | 'OR';
interface Clause { relation: Relation; expression: Expression<SqlBool> }

// SQLite gives AND precedence over OR. Keep the old append-order semantics,
// including notebook filters, rather than regrouping terms by their meaning.

function combine(initial: Expression<SqlBool>, clauses: Clause[]): Expression<SqlBool> {
	const groups: Expression<SqlBool>[][] = [[initial]];
	for (const clause of clauses) {
		if (clause.relation === 'OR') groups.push([clause.expression]);
		else groups[groups.length - 1].push(clause.expression);
	}
	return eb.or(groups.map(group => eb.and(group)));
}

const match = (field: string, value: string) => sql<boolean>`${sql.ref(field)} MATCH ${value}`;
const trimQuotes = (str: string) => str.startsWith('"') && str.endsWith('"') ? str.slice(1, -1) : str;

function unixDate(date: string): string {
	if (/^[0-9]{8}$/.test(date)) return time.formatLocalToMs(date, 'YYYYMMDD').toString();
	if (/^[0-9]{6}$/.test(date)) return time.formatLocalToMs(date, 'YYYYMM').toString();
	if (/^[0-9]{4}$/.test(date)) return time.formatLocalToMs(date, 'YYYY').toString();
	const smart = /^(day|week|month|year)(\+|-)([0-9]+)$/i.exec(date);
	if (!smart) throw new Error('Invalid date format!');
	return smart[2] === '+' ? time.goForwardInTime(Date.now(), Number(smart[3]), smart[1])
		: time.goBackInTime(Date.now(), Number(smart[3]), smart[1]);
}

export default function queryBuilder(terms: Term[], useFts: boolean) {
	const any = terms.find(term => term.name === 'any');
	const relation: Relation = any?.value === '1' ? 'OR' : 'AND';
	const table = useFts ? 'notes_fts' : 'notes';
	const normalized: string = useFts ? 'notes_normalized' : 'notes';
	const clauses: Clause[] = [];
	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Search creates CTE/table names dynamically.
	let db: QueryCreator<Record<string, Record<string, any>>> = qb;
	const append = (expression: Expression<SqlBool>, connective = relation) => clauses.push({ expression, relation: connective });

	const generic = (selected: Term[], kind: 'id' | 'date' | 'location' | 'sourceurl') => {
		for (const term of selected) {
			const field = kind === 'date' ? term.name === 'due' ? 'todo_due' : `user_${term.name}_time`
				: kind === 'sourceurl' ? 'source_url' : kind === 'id' ? 'id' : term.name;
			const op = kind === 'id' || kind === 'sourceurl' ? term.negated ? 'not like' : 'like'
				: term.negated ? '<' : '>=';
			const value = kind === 'date' ? unixDate(term.value) : term.value;
			const query = qb.selectFrom(normalized).select('ROWID').where(field, op, value);
			let condition: Expression<SqlBool> = eb('ROWID', 'in', query);
			if (term.name === 'due') condition = eb.and([eb('is_todo', 'is', 1), condition]);
			append(condition);
		}
	};

	// Keep the same filter order: ID, notebooks, tags, resources, text, type,
	// completion, dates, location, source URL.
	generic(terms.filter(term => term.name === 'id'), 'id');
	for (const negated of [false, true]) {
		const folderTerms = terms.filter(term => term.name === 'notebook' && term.negated === negated);
		if (!folderTerms.length) continue;
		const view: string = negated ? 'notebooks_not_in_scope' : 'notebooks_in_scope';
		db = db.withRecursive(`${view}(id)`, () => qb.selectFrom('folders').select('folders.id')
			.where('id', 'in', qb.selectFrom('folders').select('id').where(eb.or(folderTerms.map(term => eb('folders.title', 'like', term.value)))))
			.unionAll(qb.selectFrom('folders').innerJoin(view, 'folders.parent_id', `${view}.id`).select('folders.id'))) as unknown as typeof db;
		append(eb('ROWID', negated ? 'not in' : 'in', qb.selectFrom(view)
			.innerJoin(normalized, `${view}.id`, `${normalized}.parent_id`).select(`${normalized}.ROWID`)), 'AND');
	}

	for (const kind of ['tag', 'resource']) {
		const association = kind === 'tag' ? 'note_tags' : 'note_resources';
		const target = kind === 'tag' ? 'tags' : 'resources';
		const associatedNotes = (value: string) => {
			let query = qb.selectFrom(association).select('note_id as id')
				.where(kind === 'tag' ? 'tag_id' : 'resource_id', 'in', qb.selectFrom(target).select('id')
					.where(kind === 'tag' ? 'title' : 'mime', 'like', value));
			if (kind === 'resource') query = query.where('is_associated', '=', 1);
			return query;
		};
		for (const negated of [false, true]) {
			const selected = terms.filter(term => term.name === kind && term.negated === negated);
			if (!selected.length) continue;
			const requirement = negated ? 'EXCLUSION' : 'INCLUSION';
			const view = `notes_with_${requirement}_${target}`;
			// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Different CTE sources share the same note-ID result.
			let query: SelectQueryBuilder<any, any, { id: any }> = qb.selectFrom(association).select('note_id as id').where(sql<boolean>`0`);
			if (relation === 'OR' && negated) {
				const allView = `all_notes_with_${requirement}_${target}`;
				db = db.with(allView, () => qb.selectFrom(association).select('note_id as id').distinct()) as unknown as typeof db;
				const difference = (term: Term, index: number) => qb.selectFrom(qb.selectFrom(allView).selectAll()
					.except(associatedNotes(term.value)).as(`excluded_${index}`)).select('id');
				query = difference(selected[0], 0);
				for (let i = 1; i < selected.length; i++) query = query.union(difference(selected[i], i));
			} else if (relation === 'AND' && !negated) {
				query = qb.selectFrom(association).select('note_id as id').where(sql<boolean>`1`);
				for (const term of selected) query = query.intersect(associatedNotes(term.value));
			} else {
				for (const term of selected) query = query.union(associatedNotes(term.value));
			}
			db = db.with(view, () => query) as unknown as typeof db;
			append(eb('ROWID', relation === 'AND' && negated ? 'not in' : 'in', qb.selectFrom(view)
				.innerJoin(normalized, `${view}.id`, `${normalized}.id`).select(`${normalized}.ROWID`)));
		}
	}

	const text = terms.filter(term => ['title', 'body', 'text'].includes(term.name));
	const likeText = (term: Term, negate: boolean) => {
		const pattern = `%${trimQuotes(term.value).replace(/\*/, '%')}%`;
		const matches = [];
		if (term.name === 'text' || term.name === 'body') matches.push(eb('notes.body', 'like', pattern));
		if (term.name === 'text' || term.name === 'title') matches.push(eb('notes.title', 'like', pattern));
		append(negate ? eb.not(eb.or(matches)) : eb.or(matches));
	};
	const included = text.filter(term => !term.negated);
	if (included.length) {
		if (useFts) append(match('notes_fts', included.map(term => term.name === 'text' ? term.value : `${term.name}:${term.value}`).join(relation === 'OR' ? ' OR ' : ' ')));
		else for (const term of included) likeText(term, false);
	}
	for (const name of ['text', 'title', 'body']) {
		const excluded = text.filter(term => term.negated && term.name === name);
		if (!excluded.length) continue;
		if (!useFts) { for (const term of excluded) likeText(term, true); continue; }
		const field = name === 'text' ? 'notes_fts' : `notes_fts.${name}`;
		if (relation === 'AND') {
			append(eb('ROWID', 'not in', qb.selectFrom('notes_fts').select('ROWID').where(match(field, excluded.map(term => term.value).join(' OR ')))));
		} else {
			for (const term of excluded) {
				const difference = qb.selectFrom('notes_fts').select('ROWID')
					.except(qb.selectFrom('notes_fts').select('ROWID').where(match(field, term.value)));
				append(eb('ROWID', 'in', qb.selectFrom(difference.as('excluded_text')).selectAll()));
			}
		}
	}

	for (const name of ['type', 'iscompleted']) {
		for (const term of terms.filter(term => term.name === name)) {
			const source = useFts ? relation === 'AND' ? 'notes_fts' : 'notes_normalized' : 'notes';
			const condition = name === 'type' ? eb(`${source}.is_todo`, 'is', term.value === 'todo' ? 1 : 0)
				: eb.and([eb(`${source}.is_todo`, 'is', 1), eb(`${source}.todo_completed`, term.value === '1' ? 'is not' : 'is', 0)]);
			append(relation === 'OR' && useFts ? eb('ROWID', 'in', qb.selectFrom('notes_normalized').select('ROWID').where(condition)) : condition);
		}
	}
	generic(terms.filter(term => ['created', 'updated', 'due'].includes(term.name)), 'date');
	generic(terms.filter(term => ['latitude', 'longitude', 'altitude'].includes(term.name)), 'location');
	generic(terms.filter(term => term.name === 'sourceurl'), 'sourceurl');

	const initial = terms.some(term => term.name === 'notebook') || relation === 'AND'
		? sql<boolean>`1` : eb('ROWID', '=', -1);
	let condition: Expression<SqlBool>;
	if (terms.some(term => term.name === 'notebook') && any) {
		// Preserve the legacy special case: the first appended filter stays in
		// the outer query; subsequent filters select matching full-text row IDs.
		const inner = qb.selectFrom('notes_fts').select('ROWID').where(combine(sql<boolean>`1=0`, clauses.slice(1)));
		condition = combine(initial, [...clauses.slice(0, 1), { relation: 'AND', expression: eb('ROWID', 'in', inner) }]);
	} else { condition = combine(initial, clauses); }
	let query = db.selectFrom(table).select([
		`${table}.id`, `${table}.title`, `${table}.user_created_time`, `${table}.user_updated_time`,
		`${table}.is_todo`, `${table}.todo_completed`, `${table}.parent_id`,
	]).where(condition);
	if (useFts) {
		query = query.select([
			sql`offsets(${sql.ref('notes_fts')})`.as('offsets'),
			sql`matchinfo(${sql.ref('notes_fts')}, 'pcnalx')`.as('matchinfo'),
		]);
	}
	const compiled = compileQuery(query);
	return { query: compiled.sql, params: compiled.params };
}
