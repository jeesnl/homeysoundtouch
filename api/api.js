const Fetch = require('node-fetch');
const XmlParser = require('xml2js').Parser();
const Keys = require('./keys.js').keys;

class SoundtouchApi {
    constructor(ip) {
        this._ip = ip;
    }
    async play() {
        await this._pressKey(Keys.PLAY);
    }
    async pause() {
        await this._pressKey(Keys.PAUSE);
    }
    // this.prev_track = async () => {
    //     await this._pressKey(Keys.PREV_TRACK);
    // };
    // this.next_track = async () => {
    //     await this._pressKey(Keys.NEXT_TRACK);
    // };
    // this.power = async () => {
    //     await this._pressKey(Keys.POWER);
    // };
    // this.mute = async () => {
    //     await this._pressKey(Keys.MUTE);
    // };
    // this.shuffle_on = async () => {
    //     await this._pressKey(Keys.SHUFFLE_ON);
    // };
    // this.shuffle_off = async () => {
    //     await this._pressKey(Keys.SHUFFLE_OFF);
    // };
    // this.repeat_one = async () => {
    //     await this._pressKey(Keys.REPEAT_ONE);
    // };
    // this.repeat_all = async () => {
    //     await this._pressKey(Keys.REPEAT_ALL);
    // };
    // this.repeat_none = async () => {
    //     await this._pressKey(Keys.REPEAT_NONE);
    // };
    // this.preset_1 = async () => {
    //     await this._pressKey(Keys.PRESET_1);
    // };
    // this.preset_2 = async () => {
    //     await this._pressKey(Keys.PRESET_2);
    // };
    // this.preset_3 = async () => {
    //     await this._pressKey(Keys.PRESET_3);
    // };
    // this.preset_4 = async () => {
    //     await this._pressKey(Keys.PRESET_4);
    // };
    // this.preset_5 = async () => {
    //     await this._pressKey(Keys.PRESET_5);
    // };
    // this.preset_6 = async () => {
    //     await this._pressKey(Keys.PRESET_6);
    // };
    async _pressKey(key) {
        console.log('apipressKey', key);
        const body = `<key state="${key.state}" sender="gabbo">${key.message}</key>`;
        await this._postToSoundtouch('/key', body);
    }
    async _postToSoundtouch(uri, body) {
        try {
            return await Fetch('http://' + this._ip + ':8090' + uri, {method: 'POST', body: body});
        } catch (e) {
            return(e);
        }
    };
    async _getFromSoundtouch(uri) {
        try {
            return await Fetch('http://' + this._ip + ':8090' + uri, {method: 'GET'});
        } catch (e) {
            return (e);
        }
    };
    async _parseXML(xml) {
        return new Promise((resolve, reject) => {
            XmlParser.parseString(xml, (err, result) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result);
                }
            });
        });
    }
};

module.exports = SoundtouchApi;