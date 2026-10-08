import { compileQuery, queryBuilder, sql, selectQuery, literalStrings } from '../services/database/queryBuilder';
import BaseItem from './BaseItem';
import BaseModel from '../BaseModel';

export default class NoteTag extends BaseItem {
	public static tableName() {
		return 'note_tags';
	}

	public static modelType() {
		return BaseModel.TYPE_NOTE_TAG;
	}

	public static async byNoteIds(noteIds: string[]) {
		if (!noteIds.length) return [];
		return this.modelSelectAll(selectQuery('note_tags').where('note_id', 'in', literalStrings(noteIds)));
	}

	public static async tagIdsByNoteId(noteId: string) {
		const rows = await this.db().selectAll(compileQuery(
			queryBuilder
				.selectFrom('note_tags')
				.select(['tag_id'])
				.where((eb) => eb(sql.ref('note_id'), '=', sql.val(noteId))),
		));
		const output = [];
		for (let i = 0; i < rows.length; i++) {
			output.push(rows[i].tag_id);
		}
		return output;
	}
}
