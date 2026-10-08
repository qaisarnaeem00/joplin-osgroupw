import { queryBuilder as qb, compileQuery } from '../kysely';
import { SqlQuery } from '../types';

// Preserve the original version 4 schema and data changes.
export default (): SqlQuery[] => [
	compileQuery(
		qb.insertInto('settings').values(eb => ({
			key: eb.val('sync.3.context'),
			value: qb
				.selectFrom('settings')
				.select(['value'])
				.where(eb => eb(eb.ref('key'), '=', eb.val('sync.context'))),
		})),
	),
	compileQuery(qb.deleteFrom('settings').where(eb => eb(eb.ref('key'), '=', eb.val('sync.context')))),
];
