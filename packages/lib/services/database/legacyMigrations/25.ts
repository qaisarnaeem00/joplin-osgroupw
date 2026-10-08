import { queryBuilder as qb, compileQuery } from '../kysely';
import { SqlQuery } from '../types';

// Preserve the original version 25 schema and data changes.
export default (): SqlQuery[] => [
	compileQuery(
		qb.schema.createView('tags_with_note_count').as(
			qb
				.selectFrom('tags')
				.select(eb => [
					eb.ref('tags.id').as('id'),
					eb.ref('tags.title').as('title'),
					eb.ref('tags.created_time').as('created_time'),
					eb.ref('tags.updated_time').as('updated_time'),
					eb.fn('count', [eb.ref('notes.id')]).as('note_count'),
				])
				.leftJoin('note_tags as nt', join => join.on(eb => eb(eb.ref('nt.tag_id'), '=', eb.ref('tags.id'))))
				.leftJoin('notes', join => join.on(eb => eb(eb.ref('notes.id'), '=', eb.ref('nt.note_id'))))
				.where(eb => eb.not(eb(eb.ref('notes.id'), 'is', eb.val(null))))
				.groupBy(['tags.id']),
		),
	),
];
