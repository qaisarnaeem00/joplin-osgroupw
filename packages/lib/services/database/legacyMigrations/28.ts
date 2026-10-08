import { queryBuilder as qb, compileQuery } from '../kysely';
import { SqlQuery } from '../types';

// Preserve the original version 28 schema and data changes.
export default (): SqlQuery[] => [
	compileQuery(qb.schema.createIndex('resources_size').on('resources').columns(['size'])),
];
