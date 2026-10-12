import { addColumn } from '../sqlite';
import { StringOrSqlQuery } from '../types';

export default (): StringOrSqlQuery[] => {
	return [
		addColumn('notes', 'is_locked', 'INT NOT NULL DEFAULT 0'),
		addColumn('notes', 'extracted_resource_ids', 'TEXT NOT NULL DEFAULT ""'),
		addColumn('revisions', 'is_locked', 'INT NOT NULL DEFAULT 0'),
		addColumn('resources', 'is_locked', 'INT NOT NULL DEFAULT 0'),
	];
};
