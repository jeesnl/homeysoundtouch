const Fetch = require('node-fetch');
const XmlParser = require('xml2js').Parser();
const Keys = require('./keys.js').keys;

class SoundtouchApi {
    constructor(ip) {
        this._ip = ip;
    }

    //keys
    async play() {
        return await this._pressKey(Keys.PLAY);
    }
    async pause() {
        return await this._pressKey(Keys.PAUSE);
    }
    async prev_track() {
        return await this._pressKey(Keys.PREV_TRACK);
    };
    async next_track() {
        return await this._pressKey(Keys.NEXT_TRACK);
    };
    async power() {
        return await this._pressKey(Keys.POWER);
    };
    async mute() {
        return await this._pressKey(Keys.MUTE);
    };
    async shuffle_on() {
        return await this._pressKey(Keys.SHUFFLE_ON);
    };
    async shuffle_off() {
        return await this._pressKey(Keys.SHUFFLE_OFF);
    };
    async repeat_one() {
        return await this._pressKey(Keys.REPEAT_ONE);
    };
    async repeat_all() {
        return await this._pressKey(Keys.REPEAT_ALL);
    };
    async repeat_none() {
        return await this._pressKey(Keys.REPEAT_NONE);
    };
    async preset_1() {
        return await this._pressKey(Keys.PRESET_1);
    };
    async preset_2() {
        return await this._pressKey(Keys.PRESET_2);
    };
    async preset_3() {
        return await this._pressKey(Keys.PRESET_3);
    };
    async preset_4() {
        return await this._pressKey(Keys.PRESET_4);
    };
    async preset_5() {
        return await this._pressKey(Keys.PRESET_5);
    };
    async preset_6() {
        return await this._pressKey(Keys.PRESET_6);
    };

    //states
    async isPlaying() {
        try {
            const res = await this._getFromSoundtouch('/now_playing');
            const body = await res.text();
            const jsObj = await this._parseXML(body);
            return jsObj.nowPlaying.$.source !== 'STANDBY' && jsObj.nowPlaying.playStatus[0] !== 'PAUSE_STATE';
        } catch (e) {
            return Promise.reject(e);
        }
    }

    async getVolume() {
        const res = await this._getFromSoundtouch('/volume');
        const body = await res.text();
        const jsObj = await this._parseXML(body);
        const targetVolume = parseInt(jsObj.volume.targetvolume[0]);
        const mute = (jsObj.volume.muteenabled[0] === 'true');
        return {
            volume: targetVolume,
            mute: mute
        }
    }

    async _pressKey(key) {
        const body = `<key state="${key.state}" sender="Gabbo">${key.message}</key>`;
        return await this._postToSoundtouch('/key', body);
    }
    async _postToSoundtouch(uri, body) {
        try {
            const res = await Fetch('http://' + this._ip + ':8090' + uri, {method: 'POST', body: body});
            if (res.status === 200) {
                return Promise.resolve();
            } else {
                return Promise.reject();
            }
        } catch (e) {
            return(e);
        }
    };
    async _getFromSoundtouch(uri) {
        try {
            const res = await Fetch('http://' + this._ip + ':8090' + uri, {method: 'GET'});
            if (res.status === 200) {
                return Promise.resolve(res);
            } else {
                return Promise.reject(res);
            }
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
}

module.exports = SoundtouchApi;