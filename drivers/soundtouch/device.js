'use strict';

const Homey = require('homey');
const SoundtouchApi = require("../../api/api.js");

const POLL_INTERVAL = 5000;

class SoundtouchDevice extends Homey.Device {

    // this method is called when the Device is inited
    onInit() {
        if (this.getData().mac !== '' && (this.getSettings().mac === undefined || this.getSettings().mac === '')) {
            this.setSettings({
                mac: this.getData().mac
            });
        }
        this._api = new SoundtouchApi(this.getSettings().ip, this.getSettings().mac);
        this._registerCapabilities();

        this._startedPlayingTrigger = new Homey.FlowCardTriggerDevice('started_playing')
            .register();

        this._stoppedPlayingTrigger = new Homey.FlowCardTriggerDevice('stopped_playing')
            .register();

        this._volumeChangedTrigger = new Homey.FlowCardTriggerDevice('changed_volume')
            .register();

        const _isTurnedOnCondition = new Homey.FlowCardCondition('is_on')
            .register()
            .registerRunListener(async (args, state) => {
                try {
                    return Promise.resolve(await args.device._api.isOn());
                } catch (e) {
                    return Promise.reject(e);
                }
            });

        const _isPlayingCondition = new Homey.FlowCardCondition('is_playing')
            .register()
            .registerRunListener((args, state) => {
                return Promise.resolve(this.getCapabilityValue('speaker_playing'));
            });

        const _isInZoneCondition = new Homey.FlowCardCondition('is_in_zone')
            .register()
            .registerRunListener(async (args, state) => {
                try {
                    return Promise.resolve(await args.device._api.isInZone());
                } catch (e) {
                    return Promise.reject(e);
                }
            });

        const _isMasterInZoneCondition = new Homey.FlowCardCondition('is_zone_master')
            .register()
            .registerRunListener(async (args, state) => {
                try {
                    return Promise.resolve(await args.device._api.isZoneMaster());
                } catch (e) {
                    return Promise.reject(e);
                }
            });

        const _playPresetAction = new Homey.FlowCardAction('play_preset')
            .register()
            .registerRunListener(async (args, state) => {
                this.log('preset', args.device);
                try {
                    switch (parseInt(args.preset_number)) {
                        case 1: return Promise.resolve(await args.device._api.preset_1());
                        case 2: return Promise.resolve(await args.device._api.preset_2());
                        case 3: return Promise.resolve(await args.device._api.preset_3());
                        case 4: return Promise.resolve(await args.device._api.preset_4());
                        case 5: return Promise.resolve(await args.device._api.preset_5());
                        case 6: return Promise.resolve(await args.device._api.preset_6());
                    }
                } catch (e) {
                    return Promise.reject(e);
                }
            });

        const _setBassCapability = new Homey.FlowCardAction('bass_capability')
            .register()
            .registerRunListener(async (args, state) => {
                this.log('bass', args);
                try {
                    await args.device._api.setBassPercentage(args.bass_number * 100);
                    return Promise.resolve(true);
                } catch (e) {
                    return Promise.reject(e);
                }
            });

        const _createZoneWithAction = new Homey.FlowCardAction('create_zone_with')
            .register()
            .registerRunListener(async (args, state) => {
                this.log('create zone', args);
                try {
                    await args.device._api.createZone(args.slave.getSettings().ip, args.slave.getSettings().mac);
                    return Promise.resolve(true);
                } catch (e) {
                    return promise.reject(e);
                }
            });

        const _addSlaveToZoneAction = new Homey.FlowCardAction('add_slave_to_zone')
            .register()
            .registerRunListener(async (args, state) => {
                this.log('add slave', args);
                try {
                    await args.device._api.addSlaveToZone(args.slave.getSettings().ip, args.slave.getSettings().mac);
                    return Promise.resolve(true);
                } catch (e) {
                    return Promise.reject(e);
                }
            });

        const _removeSlaveFromZoneAction = new Homey.FlowCardAction('remove_slave_from_zone')
            .register()
            .registerRunListener(async (args, state) => {
                this.log('remove slave', args);
                try {
                    await args.device._api.removeFromZone(args.slave.getSettings().ip, args.slave.getSettings().mac);
                    return Promise.resolve();
                } catch (e) {
                    return Promise.reject(e);
                }
            });

        const _togglePowerAction = new Homey.FlowCardAction('power')
            .register()
            .registerRunListener(async (args, state) => {
                this.log('power', args);
                try {
                    const turnedOn = await args.device._api.isOn();
                    switch (args.power_onoff) {
                        case 'power_on': {
                            if (!turnedOn) {
                                return Promise.resolve(await args.device._api.power());
                            }
                            break;
                        }
                        case 'power_off': {
                            if (turnedOn) {
                                return Promise.resolve(await args.device._api.power());
                            }
                            break;
                        }
                    }
                    return Promise.resolve();
                } catch (e) {
                    return Promise.reject(e);
                }
            });

        const _setSourceAction = new Homey.FlowCardAction('set_source')
            .register()
            .registerRunListener(async (args, state) => {
                this.log('select', args);
                try {
                    args.device._api.setSource(args.source);
                    return Promise.resolve();
                } catch (e) {
                    return Promise.reject(e);
                }
            });

        const _setShuffleAction = new Homey.FlowCardAction('shuffle')
            .register()
            .registerRunListener(async (args, state) => {
                this.log('shuffle', args);
                try {
                    switch (args.shuffle) {
                        case 'shuffle_on': return Promise.resolve(await args.device._api.shuffle_on());
                        case 'shuffle_off': return Promise.resolve(await args.device._api.shuffle_off());
                    }
                } catch (e) {
                    return Promise.reject(e);
                }
            });

        const _setRepeatAction = new Homey.FlowCardAction('repeat')
            .register()
            .registerRunListener(async (args, state) => {
                this.log('repeat', args);
                try {
                    switch (args.repeat) {
                        case 'repeat_none': return Promise.resolve(await args.device._api.repeat_none());
                        case 'repeat_one': return Promise.resolve(await args.device._api.repeat_one());
                        case 'repeat_off': return Promise.resolve(await args.device._api.repeat_off());
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
        if (newSettings.ip === '' || newSettings.mac === '') {
            return Promise.reject(Homey.__('settings.empty'));
        }
        this._api.setIp(newSettings.ip);
        this._api.setMac(newSettings.mac);
        return Promise.resolve(true);
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
                return Promise.resolve(await this._api.play());
            } else {
                return Promise.resolve(await this._api.pause());
            }
        } catch (e) {
            return Promise.reject(e);
        }
    }

    async _prev(state) {
        this.log('prev', state);
        try {
            return Promise.resolve(await this._api.prev_track());
        } catch (e) {
            return Promise.reject(e);
        }
    }

    async _next(state) {
        this.log('next', state);
        try {
            return Promise.resolve(await this._api.next_track());
        } catch (e) {
            return Promise.reject(e);
        }
    }

    async _setVolume(volume) {
        this.log('volume', volume);
        try {
            return Promise.resolve(await this._api.setVolume(volume * 100));
        } catch (e) {
            return Promise.reject(e);
        }
    }

    async _setMute(mute) {
        this.log('mute', mute);
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
}

module.exports = SoundtouchDevice;