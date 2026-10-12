import { addColumn } from '../sqlite';
import { StringOrSqlQuery } from '../types';

export default (): StringOrSqlQuery[] => {
	return [
		addColumn('sync_items', 'remote_item_updated_time', 'INT NOT NULL DEFAULT 0'),
	];
};
