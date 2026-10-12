import { db, compile } from './kysely';

export default (num: number) => {
	const timestamp = Date.now();
	return compile(db.insertInto('migrations').values({ number: num, created_time: timestamp, updated_time: timestamp }));
};
