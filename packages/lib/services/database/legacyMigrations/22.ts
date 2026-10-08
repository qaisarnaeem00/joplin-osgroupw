import { queryBuilder as qb, compileQuery, sql } from '../kysely';
import { SqlQuery } from '../types';

// Preserve the original version 22 schema and data changes.
export default (): SqlQuery[] => [
	compileQuery(
		qb.schema
			.createTable('resources_to_download')
			.addColumn('id', sql.raw('INTEGER'), c => c.primaryKey())
			.addColumn('resource_id', sql.raw('TEXT'), c => c.notNull())
			.addColumn('updated_time', sql.raw('INT'), c => c.notNull())
			.addColumn('created_time', sql.raw('INT'), c => c.notNull()),
	),
	compileQuery(
		qb.schema.createIndex('resources_to_download_resource_id').on('resources_to_download').columns(['resource_id']),
	),
	compileQuery(
		qb.schema.createIndex('resources_to_download_updated_time').on('resources_to_download').columns(['updated_time']),
	),
];
