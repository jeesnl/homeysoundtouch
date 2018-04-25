const Fetch = require('node-fetch');
const XmlParser = require('xml2js').Parser();
const Keys = require('./keys.js').keys;

class SoundtouchApi {
    constructor(ip) {
        this._ip = ip;
    }
    //api settings
    setIp(ip) {
        this._ip = ip;
    }

    //config
    async getInfo() {
        const res = await this._getFromSoundtouch('/info');
        const txt = await res.text();
        const jsObj = await this._parseXML(txt);
        return {
            name: jsObj.info.name[0],
            type: jsObj.info.type[0],
            ip: jsObj.info.networkInfo[0].ipAddress[0],
            mac: jsObj.info.networkInfo[0].macAddress[0]
        };
    }
    async getBassCapabilities() {
        const res = await this._getFromSoundtouch('/bassCapabilities');
        const txt = await res.text();
        const jsObj = await this._parseXML(txt);
        if (jsObj.bassCapabilities.bassAvailable[0] === 'true') {
            return {
                bassAvailable: true,
                bassMin: parseInt(jsObj.bassCapabilities.bassMin[0]),
                bassMax: parseInt(jsObj.bassCapabilities.bassMax[0])
            }
        } else {
            return {
                bassAvailable: false
            };
        }
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

    //options
    async setVolume(percentage) {
        await this._postToSoundtouch('/volume', `<volume>${percentage}</volume>`);
    }
    async setBassPercentage(percentage) {
        const bassOptions = await this.getBassCapabilities();
        if (bassOptions.bassAvailable) {
            const bassSteps = Math.abs(100 / (bassOptions.bassMin - bassOptions.bassMax));
            const bassLevel = bassOptions.bassMin + Math.round(percentage / bassSteps);
            await this._postToSoundtouch('/bass', `<bass>${bassLevel}</bass>`);
        }
    }

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