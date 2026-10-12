import { addColumn } from '../sqlite';
import { StringOrSqlQuery } from '../types';

export default (): StringOrSqlQuery[] => {
	return [
		addColumn('sync_items', 'sync_warning_ignored', 'INT NOT NULL DEFAULT "0"'),
	];
};
