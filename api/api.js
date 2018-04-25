const Fetch = require('node-fetch');
const XmlParser = require('xml2js').Parser();
const Keys = require('./keys.js').keys;

module.exports = class SoundtouchApi {
    constructor(ip, mac) {
        this._ip = ip;
        this._mac = mac;
    }
    //api settings
    setIp(ip) {
        this._ip = ip;
    }
    setMac(mac) {
        this._mac = mac;
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
    async repeat_off() {
        return await this._pressKey(Keys.REPEAT_OFF);
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
    async setSource(source) {
        const sourceText = source.toUpperCase();
        let body = ``;
        if (sourceText === 'AUX') {
            body = `<ContentItem source="${sourceText}" sourceAccount="${sourceText}"></ContentItem>`;
        } else {
            body = `<ContentItem source="${sourceText}"></ContentItem>`
        }
        await this._postToSoundtouch('/select', body);
    }

    //zones
    async createZone(slaveIp, slaveMac) {
        if (this._ip !== slaveIp && this._mac !== slaveMac) {
            await this._postToSoundtouch('/setZone', `
                <zone master="${this._mac}">
                    <member ipaddress="${slaveIp}">${slaveMac}</member>
                </zone>
            `);
            return Promise.resolve();
        } else {
            return Promise.reject();
        }
    }
    async addSlaveToZone(slaveIp, slaveMac) {
        if (this._ip !== slaveIp && this._mac !== slaveMac) {
            await this._postToSoundtouch('/addZoneSlave', `
                <zone master="${this._mac}">
                    <member ipaddress="${slaveIp}">${slaveMac}</member>
                </zone>
            `);
            return Promise.resolve();
        } else {
            return Promise.reject();
        }
    }
    async removeFromZone(slaveIp, slaveMac) {
        if (this._ip !== slaveIp && this._mac !== slaveMac) {
            await this._postToSoundtouch('/removeZoneSlave', `
                <zone master="${this._mac}">
                    <member ipaddress="${slaveIp}">${slaveMac}</member>
                </zone>
            `);
            return Promise.resolve();
        } else {
            return Promise.reject();
        }
    }

    //states
    async isOn() {
        try {
            const res = await this._getFromSoundtouch('/now_playing');
            const body = await res.text();
            const jsObj = await this._parseXML(body);
            return (jsObj.nowPlaying.$.source !== 'STANDBY');
        } catch (e) {
            return Promise.reject(e);
        }
    }
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
    async isInZone() {
        const res = await this._getFromSoundtouch('/getZone');
        const txt = await res.text();
        const jsObj = await this._parseXML(txt);
        return jsObj.zone !== '';
    }
    async isZoneMaster() {
        const res = await this._getFromSoundtouch('/getZone');
        const txt = await res.text();
        const jsObj = await this._parseXML(txt);
        if (jsObj.zone !== '') {
            console.log('my mac: ' + this._mac);
            console.log('master mac: ' + jsObj.zone.$.master);
            if (jsObj.zone.$.master === this._mac) {
                return true;
            }
        }
        return false;
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
};