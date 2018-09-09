const yaml = require('js-yaml');
const fs = require('fs');
const MongoClient = require('mongodb').MongoClient;
const R = require('ramda');
const assert = require('assert');
const resolveCallback = require('./helpers').resolveCallback;

const config = yaml.safeLoad(fs.readFileSync('config.yaml', 'utf8'));
const DB_NAME = config.db.name;

const client = MongoClient(config.db.url);

const createIndex = (collection, indexes, uniques) =>
    R.map(i => collection.createIndex(i), indexes)
        .concat(R.map(idx => collection.createIndex(idx[0], idx[1]),
            R.map(i => R.map(k => R.zipObj([k], [1]), [i, 'unique']), uniques)));

const createAllIndexes = (cb) => {
    cb = resolveCallback(cb);
    console.log("[ STRT ] Creating indexes...");
    client.connect((err, client) => {
        assert.equal(err, null);
        const userColl = client.db(DB_NAME).collection('users');
        const locationColl = client.db(DB_NAME).collection('locations');
        const categoryColl = client.db(DB_NAME).collection('categories');
        const songColl = client.db(DB_NAME).collection('songs');
        const actionColl = client.db(DB_NAME).collection('actions');
        Promise.all(createIndex(userColl, [], ['email', 'username'])
            .concat(createIndex(locationColl, ['code', 'name', 'categories.code'], []))
            .concat(createIndex(categoryColl, ['code', 'name', 'correlation'], []))
            .concat(createIndex(actionColl, ['userId'], []))
            .concat(createIndex(songColl, ['title', 'artist', 'album', 'categories.code'], []))
        ).then((_) => {
            console.log('[ OK ] Created Indexes');
            cb();
        }).catch(err => {
            console.log("[ FAIL ] Index creation failed");
            console.log(err);
        });
    });
}

const buildSongMetadata = (cb) => {
    cb();
}
exports.createAllIndexes = createAllIndexes;
exports.buildSongMetadata = buildSongMetadata;
