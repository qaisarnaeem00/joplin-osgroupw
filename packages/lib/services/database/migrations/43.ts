import { addColumn } from '../sqlite';
import { StringOrSqlQuery } from '../types';

export default (): StringOrSqlQuery[] => {
	return [
		addColumn('notes', 'user_data', 'TEXT NOT NULL DEFAULT ""'),
		addColumn('tags', 'user_data', 'TEXT NOT NULL DEFAULT ""'),
		addColumn('folders', 'user_data', 'TEXT NOT NULL DEFAULT ""'),
		addColumn('resources', 'user_data', 'TEXT NOT NULL DEFAULT ""'),
	];
};
