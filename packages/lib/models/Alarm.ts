import { compileQuery, queryBuilder, sql } from '../services/database/queryBuilder';
import BaseModel from '../BaseModel';
import { AlarmEntity, NoteEntity } from '../services/database/types';
import Note from './Note';

export interface Notification {
	id: number;
	noteId: string;
	date: Date;
	title: string;
	body?: string;
}

export default class Alarm extends BaseModel {
	public static tableName() {
		return 'alarms';
	}

	public static modelType() {
		return BaseModel.TYPE_ALARM;
	}

	public static byNoteId(noteId: string) {
		return this.modelSelectOne(compileQuery(
			queryBuilder
				.selectFrom('alarms')
				.selectAll()
				.where((eb) => eb(sql.ref('note_id'), '=', sql.val(noteId))),
		));
	}

	public static async deleteExpiredAlarms() {
		return this.db().exec(compileQuery(
			queryBuilder.deleteFrom('alarms').where((eb) => eb(sql.ref('trigger_time'), '<=', sql.val(Date.now()))),
		));
	}

	public static async alarmIdsWithoutNotes() {
		// https://stackoverflow.com/a/4967229/561309
		const alarms = await this.db().selectAll(compileQuery(
			queryBuilder
				.selectFrom('alarms')
				.leftJoin('notes', (join) => join.on((eb) => eb(sql.ref('alarms.note_id'), '=', sql.ref('notes.id'))))
				.select(['alarms.id'])
				.where((eb) => eb(sql.ref('notes.id'), 'is', sql.val(null))),
		)) as { id: number }[];
		return alarms.map(a => {
			return a.id;
		});
	}

	public static async makeNotification(alarm: AlarmEntity, note: NoteEntity = null): Promise<Notification> {
		if (!note) {
			note = await Note.load(alarm.note_id);
		} else if (!note.todo_due) {
			this.logger().warn('Trying to create notification for note with todo_due property - reloading note object in case we are dealing with a partial note');
			note = await Note.load(alarm.note_id);
			this.logger().warn('Reloaded note:', note);
		}

		const output: Notification = {
			id: alarm.id,
			noteId: alarm.note_id,
			date: new Date(note.todo_due),
			title: note.title.substr(0, 128),
		};

		if (note.body) output.body = note.body.substr(0, 512);

		return output;
	}

	public static async allDue() {
		return this.modelSelectAll(compileQuery(
			queryBuilder
				.selectFrom('alarms')
				.selectAll()
				.where((eb) => eb(sql.ref('trigger_time'), '>=', sql.val(Date.now()))),
		));
	}
}
