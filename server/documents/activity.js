import {init} from 'meteor/tozd:activity-instrument';

import {Activity} from '/lib/documents/activity';

init(Activity, Activity.LEVEL);

// For testing.
export {Activity};
