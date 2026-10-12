import { db as qb } from '../services/database/kysely';
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
		return this.modelSelectAll(this.selectQuery().where('note_id', 'in', noteIds));
	}

	public static async tagIdsByNoteId(noteId: string) {
		const rows = await this.db().selectAll(qb.selectFrom('note_tags').select('tag_id').where('note_id', '=', noteId));
		const output = [];
		for (let i = 0; i < rows.length; i++) {
			output.push(rows[i].tag_id);
		}
		return output;
	}
}
