// Separate module so the 2 MB clip JSON is only fetched when mocap-moves.js imports this lazily.
import data from './clips.json' with { type: 'json' };
export default data;
