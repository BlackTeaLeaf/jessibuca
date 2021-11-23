import {EVENTS, MEDIA_TYPE, WORKER_CMD_TYPE, WORKER_SEND_TYPE} from "../constant";

export default class DecoderWorker {
    constructor(player) {
        this.player = player;
        this.decoderWorker = new Worker(player._opt.decoder)
        const {
            debug,
            events: {proxy},
        } = player;

        this.decoderWorker.onmessage = (event) => {
            const msg = event.data;
            switch (msg.cmd) {
                case WORKER_CMD_TYPE.init:
                    debug.log(`decoderWorker`, 'onmessage:', WORKER_CMD_TYPE.init);
                    this.player.emit(EVENTS.load);
                    this.player.emit(EVENTS.decoderWorkerInit);
                    this._initWork();
                    break;
                case WORKER_CMD_TYPE.videoCode:
                    this.player.video.updateVideoInfo({
                        encTypeCode: msg.code
                    })
                    break;
                case WORKER_CMD_TYPE.audioCode:
                    this.player.audio.updateAudioInfo({
                        encTypeCode: msg.code
                    })
                    break;
                case WORKER_CMD_TYPE.initVideo:
                    debug.log(`decoderWorker`, 'onmessage:', WORKER_CMD_TYPE.initVideo, `width:${msg.w},height:${msg.h}`);
                    this.player.video.updateVideoInfo({
                        width: msg.w,
                        height: msg.h
                    })
                    this.player.video.initCanvasViewSize();
                    this.player.video.bindOffscreen();
                    break;
                case WORKER_CMD_TYPE.initAudio:
                    debug.log(`decoderWorker`, 'onmessage:', WORKER_CMD_TYPE.initAudio, `channels:${msg.channels},sampleRate:${msg.sampleRate}`);
                    this.player.audio.updateAudioInfo(msg);
                    this.player.audio.initScriptNode(msg);
                    break;
                case WORKER_CMD_TYPE.render:
                    // debug.log(`decoderWorker`, 'onmessage:', WORKER_CMD_TYPE.render, `msg ts:${msg.ts}`);
                    if (this.player.loading) {
                        this.player.emit(EVENTS.start);
                        this.player.loading = false;
                        this.player.clearCheckLoadingTimeout();
                    }
                    if (!this.player.playing) {
                        this.player.playing = true;
                    }
                    this.player.video.render(msg);
                    this.player.emit(EVENTS.timeUpdate, msg.ts)
                    // 健康检查
                    this.player.updateStats({ts: msg.ts, buf: msg.delay})
                    this.player.checkHeart();
                    break;
                case WORKER_CMD_TYPE.playAudio:
                    // debug.log(`decoderWorker`, 'onmessage:', WORKER_CMD_TYPE.playAudio, `msg ts:${msg.ts}`);
                    // 只有在 playing 的时候。
                    if (this.player.playing) {
                        this.player.audio.play(msg.buffer, msg.ts);
                    }
                    break;
                default:
                    player[msg.cmd] && player[msg.cmd](msg);
            }
        }
        player.debug.log('decoderWorker', 'init')
    }

    _initWork() {
        this.decoderWorker.postMessage({
            cmd: WORKER_SEND_TYPE.init,
            opt: JSON.stringify(this.player._opt),
            sampleRate: this.player.audio.audioContext.sampleRate
        })
    }

    decodeVideo(arrayBuffer, ts, isIFrame) {
        const options = {
            type: MEDIA_TYPE.video,
            ts: Math.max(ts, 0),
            isIFrame
        }
        // this.player.debug.log('decoderWorker', 'decodeVideo');
        this.decoderWorker.postMessage({
            cmd: WORKER_SEND_TYPE.decode,
            buffer: arrayBuffer,
            options
        }, [arrayBuffer.buffer])
    }

    //
    decodeAudio(arrayBuffer, ts) {
        const options = {
            type: MEDIA_TYPE.audio,
            ts: Math.max(ts, 0)
        }
        // this.player.debug.log('decoderWorker', 'decodeAudio');

        this.decoderWorker.postMessage({
            cmd: WORKER_SEND_TYPE.decode,
            buffer: arrayBuffer,
            options
        }, [arrayBuffer.buffer])
    }

    destroy() {
        this.player.debug.log(`decoderWorker`, 'destroy');
        this.decoderWorker.postMessage({cmd: WORKER_SEND_TYPE.close})
        this.decoderWorker.terminate();
        this.decoderWorker = null;
        this.player = null;
    }
}