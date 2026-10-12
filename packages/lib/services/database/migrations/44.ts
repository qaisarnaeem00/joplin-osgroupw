import { db } from '../kysely';
import { addColumn } from '../sqlite';
import { StringOrSqlQuery } from '../types';

export default (): StringOrSqlQuery[] => {
	return [
		addColumn('resources', 'blob_updated_time', 'INT NOT NULL DEFAULT 0'),
		db.updateTable('resources').set(eb => ({ blob_updated_time: eb.ref('updated_time') })),
	];
};
