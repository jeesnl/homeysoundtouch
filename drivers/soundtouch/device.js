'use strict';

const Homey = require('homey');
const Fetch = require('node-fetch');
const XmlParser = require('xml2js').Parser();
const SoundtouchApi = require('../../api/api.js');

const POLL_INTERVAL = 5000;

class SoundtouchDevice extends Homey.Device {

    // this method is called when the Device is inited
    onInit() {
        this._api = new SoundtouchApi(this.getSettings().ip);
        this._registerCapabilities();

        this._startedPlayingTrigger = new Homey.FlowCardTriggerDevice('started_playing')
            .register();

        this._stoppedPlayingTrigger = new Homey.FlowCardTriggerDevice('stopped_playing')
            .register();

        this._volumeChangedTrigger = new Homey.FlowCardTriggerDevice('changed_volume')
            .register();

        const _isPlayingCondition = new Homey.FlowCardCondition('is_playing')
            .register()
            .registerRunListener((args, state) => {
                return Promise.resolve(this.getCapabilityValue('speaker_playing', true));
            });

        const _isInZoneCondition = new Homey.FlowCardCondition('is_in_zone')
            .register()
            .registerRunListener(async (args, state) => {
                try {
                    return Promise.resolve(await this._isInZone());
                } catch (e) {
                    return Promise.reject(e);
                }
            });

        const _playPresetAction = new Homey.FlowCardAction('play_preset')
            .register()
            .registerRunListener(async (args, state) => {
                try {
                    switch (parseInt(args.preset_number)) {
                        case 1: return Promise.resolve(await this._api.preset_1());
                        case 2: return Promise.resolve(await this._api.preset_2());
                        case 3: return Promise.resolve(await this._api.preset_3());
                        case 4: return Promise.resolve(await this._api.preset_4());
                        case 5: return Promise.resolve(await this._api.preset_5());
                        case 6: return Promise.resolve(await this._api.preset_6());
                    }
                } catch (e) {
                    return Promise.reject(e);
                }
            });

        const _setBassCapability = new Homey.FlowCardAction('bass_capability')
            .register()
            .registerRunListener(async (args, state) => {
                try {
                    await this._sendBassCommand(args.bass_number);
                    return Promise.resolve(true);
                } catch (e) {
                    return Promise.reject(e);
                }
            });

        const _createZoneWithAction = new Homey.FlowCardAction('create_zone_with')
            .register()
            .registerRunListener(async (args, state) => {
                try {
                    await this._createZone(args.slave);
                    return Promise.resolve(true);
                } catch (e) {
                    return promise.reject(e);
                }
            });

        const _addSlaveToZoneAction = new Homey.FlowCardAction('add_slave_to_zone')
            .register()
            .registerRunListener(async (args, state) => {
                try {
                    await this._addSlave(args.slave);
                    return Promise.resolve(true);
                } catch (e) {
                    return Promise.reject(e);
                }
            });

        const _removeSlaveFromZoneAction = new Homey.FlowCardAction('remove_slave_from_zone')
            .register()
            .registerRunListener(async (args, state) => {
                try {
                    await this._removeFromZone(args.slave);
                    return Promise.resolve();
                } catch (e) {
                    return Promise.reject(e);
                }
            });

        const _togglePowerAction = new Homey.FlowCardAction('toggle_power')
            .register()
            .registerRunListener(async (args, state) => {
                try {
                    return Promise.resolve(await this._api.power());
                } catch (e) {
                    return Promise.reject(e);
                }
            });

        const _setSourceAction = new Homey.FlowCardAction('set_source')
            .register()
            .registerRunListener(async (args, state) => {
                try {
                    await this._setSource(args.source);
                    return Promise.resolve();
                } catch (e) {
                    return Promise.reject(e);
                }
            });

        const _setShuffleAction = new Homey.FlowCardAction('shuffle')
            .register()
            .registerRunListener(async (args, state) => {
                try {
                    switch (args.shuffle) {
                        case 'shuffle_on': return Promise.resolve(await this._api.shuffle_on());
                        case 'shuffle_off': return Promise.resolve(await this._api.shuffle_off());
                    }
                } catch (e) {
                    return Promise.reject(e);
                }
            });

        const _setRepeatAction = new Homey.FlowCardAction('repeat')
            .register()
            .registerRunListener(async (args, state) => {
                try {
                    switch (args.repeat) {
                        case 'repeat_none': return Promise.resolve(await this._api.repeat_none());
                        case 'repeat_one': return Promise.resolve(await this._api.repeat_one());
                        case 'repeat_all': return Promise.resolve(await this._api.repeat_all());
                    }
                } catch (e) {
                    return Promise.reject(e);
                }
            });

        //poll playing state of speaker
        setInterval(() => {
            this._pollSpeakerState();
        }, POLL_INTERVAL)
    }

    // this method is called when the Device is added
    onAdded() {
        this.log('device added');
        this.log('name:', this.getName());
        this.log('class:', this.getClass());
        this.log('settings', this.getSettings());
        this.log('data', this.getData());
    }

    // this method is called when the Device is deleted
    onDeleted() {
        this.log('device deleted');
    }

    // this method is called when a user changes settings
    onSettings(oldSettings, newSettings, changedKeys) {
        this._api.setIp(newSettings(ip));
    }

    _registerCapabilities() {
        const capabilitySetMap = new Map([
            ['speaker_playing', this._play],
            ['speaker_prev', this._prev],
            ['speaker_next', this._next],
            ['volume_set', this._setVolume],
            ['volume_mute', this._setMute],
        ]);
        this.getCapabilities().forEach(capability =>
        this.registerCapabilityListener(capability, (value) => {
            return capabilitySetMap.get(capability).call(this, value)
                .catch(err => {
                    return Promise.reject(err);
                });
        }))
    }

    async _play(state) {
        this.log('play', state);
        try {
            if (state === true) {
                this.log('sending play');
                return Promise.resolve(await this._api.play());
            } else {
                this.log('sending pause');
                return Promise.resolve(await this._api.pause());
            }
        } catch (e) {
            return Promise.reject(e);
        }
    }

    async _prev(state) {
        try {
            return Promise.resolve(await this._api.prev_track());
        } catch (e) {
            return Promise.reject(e);
        }
    }

    async _next(state) {
        try {
            return Promise.resolve(await this._api.next_track());
        } catch (e) {
            return Promise.reject(e);
        }
    }

    async _setVolume(volume) {
        try {
            return Promise.resolve(await this._sendVolumeCommand(volume));
        } catch (e) {
            return Promise.reject(e);
        }
    }

    async _setMute(mute) {
        try {
            if (mute) {
                if (!this.getCapabilityValue('volume_mute')) {
                    return Promise.resolve(await this._api.mute());
                }
            } else {
                if (this.getCapabilityValue('volume_mute')) {
                    return Promise.resolve(await this._api.mute());
                }
            }
        } catch (e) {
            return Promise.reject(e);
        }
    }

    async _sendVolumeCommand(percentage) {
        this.log('volume', percentage);
        try {
            return await this._api.setVolume(percentage * 100);
        } catch (e) {
            return e;
        }
    }

    async _sendBassCommand(bassPercentage) {
        this.log('bass', bassPercentage);
        try {
            return await this._api.setBassPercentage(bassPercentage * 100);
        } catch (e) {
            return e;
        }
    }

    async _isInZone() {
        try {
            const res = await this._getFromSoundtouch('/getZone');
            const txt = await res.text();
            const jsObj = await this._parseXML(txt);
            if (jsObj.zone !== '') {
                return true;
            } else {
                return false;
            }
        } catch (e) {
            reject(e);
        }
    }

    async _createZone(slave) {
        this.log('create zone with', slave.getName());
        try {
            return await this._postToSoundtouch('/setZone',
                '<zone master="' + this.getData().mac + '">' +
                '<member ipaddress="' + slave.getSettings()._ip + '">' + slave.getData().mac + '</member>' +
                '</zone>');
        } catch (e) {
            return e;
        }
    }

    async _addSlave(slave) {
        this.log('add slave to zone', slave.getName());
        try {
            return await this._postToSoundtouch('/addZoneSlave',
                '<zone master="' + this.getData().mac + '">' +
                '<member ipaddress="' + slave.getSettings()._ip + '">' + slave.getData().mac + '</member>' +
                '</zone>');
        } catch (e) {
            return e;
        }
    }

    async _removeFromZone(slave) {
        this.log('remove from zone', slave.getName());
        try {
            return await this._postToSoundtouch('/removeZoneSlave',
                '<zone master="' + this.getData().mac + '">' +
                '<member ipaddress="' + slave.getSettings()._ip + '">' + slave.getData().mac + '</member>' +
                '</zone>');
        } catch (e) {
            return e;
        }
    }

    async _setSource(source) {
        this.log('select source', source);
        try {
            let body = '';
            if (source === 'aux') {
                body = '<ContentItem source="AUX" location="" sourceAccount=""></ContentItem>';
            } else if (source === 'bluetooth') {
                body = '<ContentItem source="BLUETOOTH" location="" sourceAccount=""></ContentItem>';
            }
            return await this._postToSoundtouch('/select', body);
        } catch (e) {
            return e;
        }
    }

    async _pollSpeakerState() {
        try {
            const wasPlaying = this.getCapabilityValue('speaker_playing');
            const isPlaying = await this._api.isPlaying();
            this.setCapabilityValue('speaker_playing', isPlaying);
            if (wasPlaying === false && isPlaying === true) {
                this._startedPlayingTrigger.trigger(this, null).catch(e => console.log(e));
            }
            if (wasPlaying === true && isPlaying === false) {
                this._stoppedPlayingTrigger.trigger(this, null).catch(e => console.log(e));
            }
        } catch (e) {
            return e;
        }
        try {
            const volumeData = await this._api.getVolume();
            const volume = volumeData.volume / 100;
            const mute = volumeData.mute;
            const token = {
                'volume': mute ? 0 : volume
            };
            if (this.getCapabilityValue('volume_set') !== volume ||
                    this.getCapabilityValue('volume_mute') !== mute) {
                this._volumeChangedTrigger.trigger(this, token).catch(e => console.log(e));
            }
            this.setCapabilityValue('volume_set', volume);
            this.setCapabilityValue('volume_mute', mute);
        } catch (e) {
            return e;
        }
    }

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

module.exports = SoundtouchDevice;