const MongoClient = require('mongodb').MongoClient;
const ObjectId = require('mongodb').ObjectID;
const R = require('ramda');
const assert = require('assert');
const yaml = require('js-yaml');
const fs = require('fs');
const resolveCallback = require('./helpers').resolveCallback;

const ds = require('./apis/darksky');

const MONGO_URL = 'mongodb://localhost:27017';
const DB_NAME = 'aumbiance';
const client = MongoClient(MONGO_URL);

const config = yaml.safeLoad(fs.readFileSync('config.yaml', 'utf-8'));

class DuplicateKeyError extends Error {
    constructor(coll) {
        super(`duplicate field in ${coll}`);
        this.name = this.constructor.name;
    }
}

class MissingFieldError extends Error {
    constructor(key) {
        super(`missing key ${key}`);
        this.name = this.constructor.name;
    }
}

class BadArgumentError extends Error {
    constructor(arg) {
        super(`bad argument ${arg}`);
        this.name = this.constructor.name;
    }
}

const insertUser = (newUser, cb) => {
    cb = resolveCallback(cb);
    newUser = R.pick(['username', 'email'], newUser);
    if (R.all(x => x, R.map(key => R.has(key, newUser), ['username', 'email'])) === false) {
        cb(new MissingFieldError('missing either username or email'), null);
    }
    client.connect((err, client) => {
        if (err !== null) {
            cb(err, null);
            return;
        }
        const userColl = client.db(DB_NAME).collection('users');
        newUser['dateCreated'] = Date.now;
        newUser['lastModified'] = Date.now;
        newUser['preferences'] = [];
        userColl.insertOne(newUser, (err, results) => {
            cb(err, (err === null) ? results['insertedId'] : null);
        });
    });
}

const updateUser = (uid, userData, cb) => {
    cb = resolveCallback(cb);
    userData = R.pick(['username', 'email'], userData);
    client.connect((err, client) => {
        if (err !== null) {
            cb(err, null);
            return;
        }
        const userColl = client.db(DB_NAME).collection('users');
        userData['lastModified'] = Date.now;
        userColl.updateOne({'_id': ObjectId(uid)}, {'$set': userData}, (e, c, d) => {
            cb(e, c);
        });
    });
}

const updatePreferences = (userId, prefs, cb) => {
    cb = resolveCallback(cb);
    client.connect((err, client) => {
        if (err !== null) {
            cb(err, null);
            return;
        }
        const userColl = client.db(DB_NAME).collection('users');
        userColl.updateOne({'_id': ObjectId(userId)}, {'$push': {'preferences': prefs}}, (e, c, d) => {
            cb(e, c);
        });
    });
}

const getUser = (userId, cb) => {
    userId = config.test.user._id;
    cb = resolveCallback(cb);
    client.connect((err, client) => {
        if (err !== null) {
            cb(err, null);
            return;
        }
        const userColl = client.db(DB_NAME).collection('users');
        userColl.findOne({"_id": ObjectId(userId)}, cb);
    });
}

const getLocations = (codes, cb) => {
    cb = resolveCallback(cb);
    client.connect((err, client) => {
        if (err !== null) {
            cb(err, null);
            return;
        }
        const locationColl = client.db(DB_NAME).collection('locations');
        if (R.isEmpty(codes)) { locationColl.find({}).toArray(cb); }
        else { locationColl.find({'code': {'$in': codes}}).toArray(cb); }
    });
}

const getCategories = (codes, cb) => {
    cb = resolveCallback(cb);
    client.connect((err, client) => {
        if (err !== null) {
            cb(err, null);
            return;
        }
        const categoryColl = client.db(DB_NAME).collection('categories');
        if (R.isEmpty(codes)) { categoryColl.find({}).toArray(cb); }
        else { categoryColl.find({'code': {'$in': codes}}).toArray(cb); }
    });
}

const insertSongs = (songs, cb) => {
    client.connect((err, client) => {
        const songColl = client.db(DB_NAME).collection('songs');
        songColl.insertMany(songs, (err, results) => {
            cb(err, results);
        });
    });
}

const getSong = (id, cb) => {
    cb = resolveCallback(cb);
    if (id === null) {
        cb(new BadArgumentError('id'), null);
        return;
    }
    client.connect((err, client) => {
        if (err !== null) {
            cb(err, null);
            return;
        }
        const songColl = client.db(DB_NAME).collection('songs');
        songColl.findOne({'_id': ObjectId(id)}, cb);
    });
}

const getClient = () => client;

// gets a song which possesses certain associated traits
// types: object containing {..., code: stddev, ...}
const getSongsForLocationTypes = (types, cb) => {
    cb = resolveCallback(cb);
    if (types === null || R.isEmpty(types)) {
        cb(new BadArgumentError('types'), null);
        return;
    }
    client.connect((err, client) => {
        if (err !== null) {
            cb(err, null);
            return;
        }
        const locationColl = client.db(DB_NAME).collection('locations');
        const songColl = client.db(DB_NAME).collection('songs');
        locationColl.find({ 'code': { '$in': types } }, { 'categories': 1, '_id': 0 }).toArray((err, data) => {
            songColl.find({ 'categories': { '$in': R.flatten(data) } }).toArray(cb);
        });
    });
}

const getSongsForCategoryTypes = (categories, cb) => {
    cb = resolveCallback(cb);
    if (types === null || R.isEmpty(types)) {
        cb(new BadArgumentError('types'), null);
        return;
    }
    client.connect((err, client) => {
        if (err !== null) {
            cb(err, null);
            return;
        }
        const songColl = client.db(DB_NAME).collection('songs');
        songColl.find({ 'categories': { '$in': categories } }).toArray(cb);
    });
}

const updateUserAction = (action, cb) => {
    cb = resolveCallback(cb);
    client.connect((err, client) => {
        if (err !== null) {
            cb(err, null);
            return;
        }
        const songColl = client.db(DB_NAME).collection('songs');
        try {
            songColl.findOne({'_id': ObjectId(action['song'])}, (err, _) => {
                if (result === null) {
                    cb(new BadArgumentError('unrecognized song id'), 400);
                    return;
                }
                const userId = action['user'];
                const song = action['song'];
                switch(action['action']) {
                    case 'PLAY':
                        break
                    case 'PAUSE':
                        break
                    case 'SKIP':
                        break
                    case 'PLAYLIST_ADD':
                        break
                    case 'PLAYLIST_REMOVE':
                        break
                }
                cb(err, 200);
            });
        } catch (error) {
            cb(error, 400);
        }
    });
}

const storeCreds = (userId, creds, cb) => {
    userId = config.test.user._id;
    cb = resolveCallback(cb);
    client.connect((err, client) => {
        if (err !== null) {
            cb(err, null);
            return;
        }
        const credsColl = client.db(DB_NAME).collection("credentials");
        creds['owner'] = userId;
        credsColl.updateOne({'owner': userId}, {$set: creds}, {upsert: 1}, (e, c, d) => {
            cb(e, c);
        });
    });
}

const getCreds = (userId, cb) => {
    userId = config.test.user._id;
    client.connect((err, client) => {
        if (err !== null) {
            cb(err, null);
            return;
        }
        const credsColl = client.db(DB_NAME).collection('credentials');
        credsColl.findOne({'owner': userId}, cb);
    });
}

const exportThese = [ insertUser, getUser, updateUser, getLocations, getCategories, getSong,
    getSongsForLocationTypes, getSongsForCategoryTypes, updateUserAction, storeCreds, updatePreferences,
        getCreds, getClient, DB_NAME, insertSongs ];

R.forEach(ex => exports[ex.name] = ex, exportThese);
