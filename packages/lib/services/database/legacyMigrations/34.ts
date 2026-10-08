import { virtualTable } from '../sqlite';
import { SqlQuery } from '../types';

// Preserve the original version 34 schema and data changes.
export default (): SqlQuery[] => [
	virtualTable('search_aux', 'fts4aux', 'notes_fts'),
	virtualTable('notes_spellfix', 'spellfix1', null),
];
