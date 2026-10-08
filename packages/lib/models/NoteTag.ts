import { literalList, queryBuilder as qb, compileQuery } from '../services/database/kysely';
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
		return this.modelSelectAll(compileQuery(qb.selectFrom('note_tags').selectAll().where(eb => eb(eb.ref('note_id'), 'in', literalList(noteIds)))));
	}

	public static async tagIdsByNoteId(noteId: string) {
		const rows = await this.db().selectAll(compileQuery(qb.selectFrom('note_tags').select(['tag_id']).where(eb => eb(eb.ref('note_id'), '=', eb.val(noteId)))));
		const output = [];
		for (let i = 0; i < rows.length; i++) {
			output.push(rows[i].tag_id);
		}
		return output;
	}
}
