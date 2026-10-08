/* eslint-disable id-denylist */
import { Expression, expressionBuilder, SqlBool, QueryCreator } from 'kysely';
import time from '../../time';
import { compileQuery, queryBuilder as db, sql } from '../database/queryBuilder';

interface Term {
	name: string;
	value: string;
	negated: boolean;
}

type Relation = 'AND' | 'OR';
type Predicate = Expression<SqlBool>;
const eb = expressionBuilder<Record<string, Record<string, unknown>>, string>();
const match = (field: string, value: string): Predicate => sql<SqlBool>`${sql.ref(field)} MATCH ${value}`;

// Preserve SQL's AND-before-OR precedence when filters use different connectives.
const combine = (initial: Predicate, conditions: { relation: Relation; predicate: Predicate }[]) => {
	const groups: Predicate[][] = [[initial]];
	for (const condition of conditions) {
		if (condition.relation === 'OR') groups.push([condition.predicate]);
		else groups[groups.length - 1].push(condition.predicate);
	}
	return eb.or(groups.map(group => eb.and(group)));
};

const dateValue = (date: string): string => {
	if (/^[0-9]{8}$/.test(date)) return time.formatLocalToMs(date, 'YYYYMMDD').toString();
	if (/^[0-9]{6}$/.test(date)) return time.formatLocalToMs(date, 'YYYYMM').toString();
	if (/^[0-9]{4}$/.test(date)) return time.formatLocalToMs(date, 'YYYY').toString();
	const relative = /^(day|week|month|year)(\+|-)([0-9]+)$/i.exec(date);
	if (!relative) throw new Error('Invalid date format!');
	return relative[2] === '+'
		? time.goForwardInTime(Date.now(), Number(relative[3]), relative[1])
		: time.goBackInTime(Date.now(), Number(relative[3]), relative[1]);
};

export default function queryBuilder(terms: Term[], useFts: boolean) {
	const relation: Relation = terms.find(term => term.name === 'any')?.value === '1' ? 'OR' : 'AND';
	const table = useFts ? 'notes_fts' : 'notes';
	const normalized = useFts ? 'notes_normalized' : 'notes';
	const conditions: { relation: Relation; predicate: Predicate }[] = [];
	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Search CTE names and tables are dynamic
	let builder: QueryCreator<any> = db;
	let hasWith = false;
	const add = (predicate: Predicate, connective: Relation = relation) => conditions.push({ relation: connective, predicate });

	const genericFilter = (name: string, field: string) => {
		for (const term of terms.filter(term => term.name === name)) {
			let predicate: Predicate;
			if (field === 'id' || field === 'sourceurl') {
				predicate = eb(field === 'id' ? 'id' : `${normalized}.source_url`, term.negated ? 'not like' : 'like', term.value);
			} else {
				const column = field === 'date' ? (name === 'due' ? 'todo_due' : `${normalized}.user_${name}_time`) : `${normalized}.${name}`;
				predicate = eb(column, term.negated ? '<' : '>=', field === 'date' ? dateValue(term.value) : term.value);
			}
			const rowIds = db.selectFrom(normalized).select('ROWID').where(predicate);
			const inRows = eb('ROWID', 'in', rowIds);
			add(name === 'due' ? eb.and([eb('is_todo', 'is', 1), inRows]) : inRows);
		}
	};

	genericFilter('id', 'id');

	for (const excluded of [false, true]) {
		const notebooks = terms.filter(term => term.name === 'notebook' && term.negated === excluded).map(term => term.value);
		if (!notebooks.length) continue;
		const view: string = excluded ? 'notebooks_not_in_scope' : 'notebooks_in_scope';
		builder = builder.withRecursive(`${view}(id)`, cte => cte.selectFrom('folders').select('folders.id')
			.where('id', 'in', db.selectFrom('folders').select('id').where(eb.or(notebooks.map(title => eb('folders.title', 'like', title)))))
			.unionAll(cte.selectFrom('folders').innerJoin(view, 'folders.parent_id', `${view}.id`).select('folders.id')));
		hasWith = true;
		add(eb('ROWID', excluded ? 'not in' : 'in', db.selectFrom(view)
			.innerJoin(normalized, `${view}.id`, `${normalized}.parent_id`).select(`${normalized}.ROWID`)), 'AND');
	}

	for (const name of ['tag', 'resource']) {
		const tableName = name === 'tag' ? 'tags' : 'resources';
		const linkTable = `note_${tableName}`;
		const idsForValue = (value: string) => {
			const ids = db.selectFrom(tableName).select(`${tableName}.id`).where(`${tableName}.${name === 'tag' ? 'title' : 'mime'}`, 'like', value);
			let query = db.selectFrom(linkTable).select(`${linkTable}.note_id as id`).where(`${linkTable}.${name === 'tag' ? 'tag_id' : 'resource_id'}`, 'in', ids);
			if (name === 'resource') query = query.where('note_resources.is_associated', '=', 1);
			return query;
		};
		for (const excluded of [false, true]) {
			const values = terms.filter(term => term.name === name && term.negated === excluded).map(term => term.value);
			if (!values.length) continue;
			const requirement = excluded ? 'EXCLUSION' : 'INCLUSION';
			const view = `notes_with_${requirement}_${tableName}`;
			let requiredNotes;
			if (relation === 'OR' && excluded) {
				const allView = `all_notes_with_${requirement}_${tableName}`;
				builder = builder.withRecursive(allView, () => db.selectFrom(linkTable).select(`${linkTable}.note_id as id`).distinct());
				const missingValue = (value: string) => db.selectFrom(db.selectFrom(allView).selectAll().except(idsForValue(value)).as('missing')).selectAll();
				requiredNotes = missingValue(values[0]);
				for (const value of values.slice(1)) requiredNotes = requiredNotes.union(missingValue(value));
			} else {
				const intersect = relation === 'AND' && !excluded;
				requiredNotes = db.selectFrom(linkTable).select(`${linkTable}.note_id as id`).where(sql<SqlBool>`${sql.lit(intersect ? 1 : 0)}`);
				for (const value of values) requiredNotes = intersect ? requiredNotes.intersect(idsForValue(value)) : requiredNotes.union(idsForValue(value));
			}
			builder = builder.withRecursive(view, () => requiredNotes);
			hasWith = true;
			add(eb('ROWID', relation === 'AND' && excluded ? 'not in' : 'in', db.selectFrom(view)
				.innerJoin(normalized, `${view}.id`, `${normalized}.id`).select(`${normalized}.ROWID`)));
		}
	}

	const textTerms = terms.filter(term => ['text', 'title', 'body'].includes(term.name));
	const trimQuotes = (value: string) => value.startsWith('"') && value.endsWith('"') ? value.slice(1, -1) : value;
	const likeText = (term: Term) => {
		const pattern = `%${trimQuotes(term.value).replace(/\*/, '%')}%`;
		const matches = [];
		if (term.name === 'text' || term.name === 'body') matches.push(eb('notes.body', 'like', pattern));
		if (term.name === 'text' || term.name === 'title') matches.push(eb('notes.title', 'like', pattern));
		const predicate = eb.or(matches);
		add(term.negated ? eb.not(predicate) : predicate);
	};
	const includedText = textTerms.filter(term => !term.negated);
	if (includedText.length) {
		if (useFts) add(match('notes_fts', includedText.map(term => term.name === 'text' ? term.value : `${term.name}:${term.value}`).join(relation === 'OR' ? ' OR ' : ' ')));
		else for (const term of includedText) likeText(term);
	}
	for (const name of ['text', 'title', 'body']) {
		const excluded = textTerms.filter(term => term.name === name && term.negated);
		if (!excluded.length) continue;
		if (!useFts) {
			for (const term of excluded) likeText(term);
		} else if (relation === 'AND') {
			add(eb('ROWID', 'not in', db.selectFrom('notes_fts').select('ROWID').where(match(name === 'text' ? 'notes_fts' : `notes_fts.${name}`, excluded.map(term => term.value).join(' OR ')))));
		} else {
			for (const term of excluded) {
				const remaining = db.selectFrom('notes_fts').select('ROWID').except(db.selectFrom('notes_fts').select('ROWID').where(match(name === 'text' ? 'notes_fts' : `notes_fts.${name}`, term.value)));
				add(eb('ROWID', 'in', db.selectFrom(remaining.as('remaining')).selectAll()));
			}
		}
	}

	for (const name of ['type', 'iscompleted']) {
		for (const term of terms.filter(term => term.name === name)) {
			const target = useFts ? (relation === 'AND' ? 'notes_fts' : 'notes_normalized') : 'notes';
			const predicate = name === 'type' ? eb(`${target}.is_todo`, 'is', term.value === 'todo' ? 1 : 0)
				: eb.and([eb(`${target}.is_todo`, 'is', 1), eb(`${target}.todo_completed`, term.value === '1' ? 'is not' : 'is', 0)]);
			add(useFts && relation === 'OR' ? eb('ROWID', 'in', db.selectFrom('notes_normalized').select('ROWID').where(predicate)) : predicate);
		}
	}
	// Keep the same filter order as the legacy query: it affects mixed AND/OR searches.
	for (const term of terms.filter(term => ['created', 'updated', 'due'].includes(term.name))) {
		const column = term.name === 'due' ? 'todo_due' : `${normalized}.user_${term.name}_time`;
		const rowIds = db.selectFrom(normalized).select('ROWID').where(column, term.negated ? '<' : '>=', dateValue(term.value));
		const predicate = eb('ROWID', 'in', rowIds);
		add(term.name === 'due' ? eb.and([eb('is_todo', 'is', 1), predicate]) : predicate);
	}
	for (const term of terms.filter(term => ['latitude', 'longitude', 'altitude'].includes(term.name))) {
		add(eb('ROWID', 'in', db.selectFrom(normalized).select('ROWID').where(`${normalized}.${term.name}`, term.negated ? '<' : '>=', term.value)));
	}
	genericFilter('sourceurl', 'sourceurl');

	let query = builder.selectFrom(table).select([
		`${table}.id`, `${table}.title`, `${table}.user_created_time`, `${table}.user_updated_time`,
		`${table}.is_todo`, `${table}.todo_completed`, `${table}.parent_id`,
	]);
	if (useFts) {
		query = query.select([
			db.fn('offsets', [sql.ref('notes_fts')]).as('offsets'),
			db.fn('matchinfo', [sql.ref('notes_fts'), sql.val('pcnalx')]).as('matchinfo'),
		]);
	}
	const initial = !terms.some(term => term.name === 'notebook') && relation === 'OR' ? eb('ROWID', '=', -1) : sql<SqlBool>`1`;
	if (hasWith && terms.some(term => term.name === 'notebook') && terms.some(term => term.name === 'any')) {
		// The notebook filter remains independent of the other OR filters.
		const first = conditions.slice(0, 1);
		query = query.where(combine(initial, first)).where('ROWID', 'in', db.selectFrom('notes_fts').select('ROWID')
			.where(combine(eb(sql.lit(1), '=', sql.lit(0)), conditions.slice(1))));
	} else {
		query = query.where(combine(initial, conditions));
	}
	const compiled = compileQuery(query);
	return { query: compiled.sql, params: compiled.params };
}
