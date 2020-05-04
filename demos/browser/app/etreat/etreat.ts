// Copyright 2019-2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import '../../style.scss';
import 'bootstrap';

import {
  AsyncScheduler,
  AudioVideoFacade,
  AudioVideoObserver,
  ClientMetricReport,
  ConsoleLogger,
  DefaultActiveSpeakerPolicy,
  DefaultAudioMixController,
  DefaultDeviceController,
  DefaultMeetingSession,
  Device,
  DeviceChangeObserver,
  LogLevel,
  MeetingSession,
  MeetingSessionConfiguration,
  MeetingSessionStatus,
  MeetingSessionStatusCode,
  MeetingSessionVideoAvailability,
  ScreenMessageDetail,
  ScreenShareFacadeObserver,
  TimeoutScheduler,
  //Versioning,
  VideoTileState,
} from '../../../../src/index';

// import * as ko from "knockout"
import * as $ from "jquery"
import "datatables.net";
//import "header.html";

// import "datatables-epresponsive";
// import "datatables.net-dt";

class DemoTileOrganizer {
  private static MAX_TILES = 16;
  private tiles: { [id: number]: number } = {};

  acquireTileIndex(tileId: number): number {
    for (let index = 0; index < DemoTileOrganizer.MAX_TILES; index++) {
      if (this.tiles[index] === tileId) {
        return index;
      }
    }
    for (let index = 0; index < DemoTileOrganizer.MAX_TILES; index++) {
      if (!(index in this.tiles)) {
        this.tiles[index] = tileId;
        return index;
      }
    }
    throw new Error('no tiles are available');
  }

  releaseTileIndex(tileId: number): number {
    for (let index = 0; index < DemoTileOrganizer.MAX_TILES; index++) {
      if (this.tiles[index] === tileId) {
        delete this.tiles[index];
        return index;
      }
    }
    return DemoTileOrganizer.MAX_TILES;
  }
}

class TestSound {
  constructor(
    sinkId: string | null,
    frequency: number = 440,
    durationSec: number = 1,
    rampSec: number = 0.1,
    maxGainValue: number = 0.1
  ) {
    // @ts-ignore
    const audioContext: AudioContext = new (window.AudioContext || window.webkitAudioContext)();
    const gainNode = audioContext.createGain();
    gainNode.gain.value = 0;
    const oscillatorNode = audioContext.createOscillator();
    oscillatorNode.frequency.value = frequency;
    oscillatorNode.connect(gainNode);
    const destinationStream = audioContext.createMediaStreamDestination();
    gainNode.connect(destinationStream);
    const currentTime = audioContext.currentTime;
    const startTime = currentTime + 0.1;
    gainNode.gain.linearRampToValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(maxGainValue, startTime + rampSec);
    gainNode.gain.linearRampToValueAtTime(maxGainValue, startTime + rampSec + durationSec);
    gainNode.gain.linearRampToValueAtTime(0, startTime + rampSec * 2 + durationSec);
    oscillatorNode.start();
    const audioMixController = new DefaultAudioMixController();
    // @ts-ignore
    audioMixController.bindAudioDevice({ deviceId: sinkId });
    audioMixController.bindAudioElement(new Audio());
    audioMixController.bindAudioStream(destinationStream.stream);
    new TimeoutScheduler((rampSec * 2 + durationSec + 1) * 1000).start(() => {
      audioContext.close();
    });
  }
}

export class eTreatApp implements AudioVideoObserver, DeviceChangeObserver {
  userId: string | null = null;
  passwd: string | null = null;
  centerName: string | null = null;

  showActiveSpeakerScores = false;
  activeSpeakerLayout = true;
  meeting: string | null = null;
  name: string | null = null;
  voiceConnectorId: string | null = null;
  sipURI: string | null = null;
  region: string | null = null;
  static readonly DID: string = '+17035550122';
  static readonly BASE_URL: string = [location.protocol, '//', location.host, location.pathname.replace(/\/*$/, '/')].join('');

  meetingSession: MeetingSession | null = null;
  audioVideo: AudioVideoFacade | null = null;
  tileOrganizer: DemoTileOrganizer = new DemoTileOrganizer();
  canStartLocalVideo: boolean = true;
  // eslint-disable-next-line
  roster: any = {};
  tileIndexToTileId: { [id: number]: number } = {};
  tileIdToTileIndex: { [id: number]: number } = {};

  cameraDeviceIds: string[] = [];
  microphoneDeviceIds: string[] = [];

  buttonStates: { [key: string]: boolean } = {
    'button-microphone': true,
    'button-camera': false,
    'button-speaker': true,
    'button-screen-share': false,
    'button-screen-view': false,
    'button-pause-screen-share': false,
  };

  // feature flags
  enableWebAudio = false;

  constructor() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).app = this;


    this.switchToFlow('flow-login');
    //var header_d = this.importHeaderHtml();
    //document.getElementById('header').innerHTML = header_d;
    this.initEventListeners();
    //this.initParameters();
  }

  authenticateUser(): void {
    // console.log("user id = " + this.userId);
    // console.log("passwd = " + this.passwd);
    // console.log("location = " + this.location);
  }

  // startMeeting(): void {
  //   this.switchToFlow('flow-authenticate');
  //
  //   this.initEventListeners();
  //   this.initParameters();
  // }

  initParameters(): void {
    const meeting = new URL(window.location.href).searchParams.get('m');
    if (meeting) {
      (document.getElementById('location') as HTMLInputElement).value = meeting;
      (document.getElementById('inputName') as HTMLInputElement).focus();
    } else {
      (document.getElementById('location') as HTMLInputElement).focus();
    }
  }

  initEventListeners(): void {
    window.addEventListener('resize', () => {
      this.layoutVideoTiles();
    });

    //------------- rakesh
    document.getElementById('form-login').addEventListener('submit', e => {
      e.preventDefault();
      this.userId = (document.getElementById('userId') as HTMLInputElement).value;
      this.passwd = (document.getElementById('passwd') as HTMLInputElement).value;
      this.centerName = (document.getElementById('location') as HTMLInputElement).value;

      this.meeting = this.centerName;
      this.name = this.userId;
      this.region = "us-east-1";

      new AsyncScheduler().start(async () => {
        try {
          this.authenticateUser();
          //var header_d = this.importHeaderHtml();
          //document.getElementById('header').innerHTML = header_d;

          this.switchToFlow('flow-center-info');
          document.getElementById('center-info').innerHTML = this.meeting;
          this.initParameters();
          this.loadPatientList_db();
          //this.setMeetingInfo();
          //this.startAudioPreview();


        } catch (error) {
          console.log("login failed: " + error);
          //document.getElementById('failed-join').innerHTML = `Meeting ID: ${this.meeting}`;
          //document.getElementById('failed-join-error').innerHTML = `Error: ${error.message}`;
        }
      });
    });

    //--------------
    // document.getElementById('form-authenticate').addEventListener('submit', e => {
    //   e.preventDefault();
    //   this.meeting = (document.getElementById('inputMeeting') as HTMLInputElement).value;
    //   this.name = (document.getElementById('inputName') as HTMLInputElement).value;
    //   this.region = (document.getElementById('inputRegion') as HTMLInputElement).value;
    //   new AsyncScheduler().start(
    //     async (): Promise<void> => {
    //       this.showProgress('progress-authenticate');
    //       try {
    //         await this.authenticate();
    //       } catch (error) {
    //         (document.getElementById(
    //           'failed-meeting'
    //         ) as HTMLDivElement).innerHTML = `Meeting ID: ${this.meeting}`;
    //         (document.getElementById('failed-meeting-error') as HTMLDivElement).innerHTML =
    //           error.message;
    //         this.switchToFlow('flow-failed-meeting');
    //         return;
    //       }
    //       (document.getElementById(
    //         'meeting-id'
    //       ) as HTMLSpanElement).innerHTML = `${this.meeting} (${this.region})`;
    //       (document.getElementById('info-meeting') as HTMLSpanElement).innerHTML = this.meeting;
    //       (document.getElementById('info-name') as HTMLSpanElement).innerHTML = this.name;
    //       this.switchToFlow('flow-devices');
    //       await this.openAudioInputFromSelection();
    //       try {
    //         await this.openVideoInputFromSelection(
    //           (document.getElementById('video-input') as HTMLSelectElement).value,
    //           true
    //         );
    //       } catch (err) {
    //         this.log('no video input device selected');
    //       }
    //       await this.openAudioOutputFromSelection();
    //       this.hideProgress('progress-authenticate');
    //     }
    //   );
    // });

    // document.getElementById('to-sip-flow').addEventListener('click', e => {
    //   e.preventDefault();
    //   this.switchToFlow('flow-sip-authenticate');
    // });
    //
    // document.getElementById('form-sip-authenticate').addEventListener('submit', e => {
    //   e.preventDefault();
    //   this.meeting = (document.getElementById('sip-inputMeeting') as HTMLInputElement).value;
    //   this.voiceConnectorId = (document.getElementById(
    //     'voiceConnectorId'
    //   ) as HTMLInputElement).value;
    //
    //   new AsyncScheduler().start(
    //     async (): Promise<void> => {
    //       this.showProgress('progress-authenticate');
    //       try {
    //         const response = await fetch(
    //           `${eTreatApp.BASE_URL}join?title=${encodeURIComponent(this.meeting)}&name=${encodeURIComponent(eTreatApp.DID)}&region=${encodeURIComponent(this.region)}`,
    //           {
    //             method: 'POST',
    //           }
    //         );
    //         const json = await response.json();
    //         const joinToken = json.JoinInfo.Attendee.JoinToken;
    //         this.sipURI = `sip:${eTreatApp.DID}@${this.voiceConnectorId};transport=tls;X-joinToken=${joinToken}`;
    //         this.switchToFlow('flow-sip-uri');
    //       } catch (error) {
    //         (document.getElementById(
    //           'failed-meeting'
    //         ) as HTMLDivElement).innerHTML = `Meeting ID: ${this.meeting}`;
    //         (document.getElementById('failed-meeting-error') as HTMLDivElement).innerHTML =
    //           error.message;
    //         this.switchToFlow('flow-failed-meeting');
    //         return;
    //       }
    //       const sipUriElement = document.getElementById('sip-uri') as HTMLInputElement;
    //       sipUriElement.value = this.sipURI;
    //       this.hideProgress('progress-authenticate');
    //     }
    //   );
    // });
    //
    // document.getElementById('copy-sip-uri').addEventListener('click', () => {
    //   const sipUriElement = document.getElementById('sip-uri') as HTMLInputElement;
    //   sipUriElement.select();
    //   document.execCommand('copy');
    // });

    const audioInput = document.getElementById('audio-input') as HTMLSelectElement;
    audioInput.addEventListener('change', async (_ev: Event) => {
      this.log('audio input device is changed');
      await this.openAudioInputFromSelection();
    });

    const videoInput = document.getElementById('video-input') as HTMLSelectElement;
    videoInput.addEventListener('change', async (_ev: Event) => {
      this.log('video input device is changed');
      try {
        await this.openVideoInputFromSelection(videoInput.value, true);
      } catch (err) {
        this.log('no video input device selected');
      }
    });

    const videoInputQuality = document.getElementById('video-input-quality') as HTMLSelectElement;
    videoInputQuality.addEventListener('change', async (_ev: Event) => {
      this.log('Video input quality is changed');
      switch (videoInputQuality.value) {
        case '360p':
          this.audioVideo.chooseVideoInputQuality(640, 360, 15, 600);
          break;
        case '540p':
          this.audioVideo.chooseVideoInputQuality(960, 540, 15, 1400);
          break;
        case '720p':
          this.audioVideo.chooseVideoInputQuality(1280, 720, 15, 1400);
          break;
      }
      try {
        await this.openVideoInputFromSelection(videoInput.value, true);
      } catch (err) {
        this.log('no video input device selected');
      }
    });

    const audioOutput = document.getElementById('audio-output') as HTMLSelectElement;
    audioOutput.addEventListener('change', async (_ev: Event) => {
      this.log('audio output device is changed');
      await this.openAudioOutputFromSelection();
    });

    document.getElementById('button-test-sound').addEventListener('click', e => {
      e.preventDefault();
      const audioOutput = document.getElementById('audio-output') as HTMLSelectElement;
      new TestSound(audioOutput.value);
    });

    //document.getElementById('form-devices').addEventListener('submit', e => {
    document.getElementById('joinButton').addEventListener('click', e => {
      e.preventDefault();
      new AsyncScheduler().start(async () => {
        try {
          //this.showProgress('progress-join');
          await this.join();
          this.audioVideo.stopVideoPreviewForVideoInput(document.getElementById(
            'video-preview'
          ) as HTMLVideoElement);
          this.audioVideo.chooseVideoInputDevice(null);
          //this.hideProgress('progress-join');
          this.displayButtonStates();
          //this.switchToFlow('flow-meeting');
          this.switchToCameraTab();

        } catch (error) {
          document.getElementById('failed-join').innerHTML = `Meeting ID: ${this.meeting}`;
          document.getElementById('failed-join-error').innerHTML = `Error: ${error.message}`;
        }
      });
    });
    document.getElementById('checkDeviceBtn').addEventListener('click', e => {
      e.preventDefault();

      this.setMeetingInfo();
      this.setupDeviceLabelTrigger_my();
      this.startAudioPreview();
      (<HTMLInputElement>document.getElementById('checkDeviceBtn')).disabled = true;

    });

    document.getElementById('refreshListBtn').addEventListener('click', e => {
      e.preventDefault();
      //$("#bs-example").dataTable().fnDestroy();

      var patient_list: any = null;

      var table = $('#bs-example').DataTable();
      //table.clear().rows.add(patient_list).draw();;
      table.clear().draw();;

      this.getAllPatients()
        .then((json) => {
          console.log(json);
          patient_list = json;


          //console.log("list from server 1= " + patient_list);


          table.rows.add(patient_list).draw();;
          this.setPatientListDetailBtns(patient_list);
          //this.loadPatientList_db();

        })
    });

    const buttonMute = document.getElementById('button-microphone');
    buttonMute.addEventListener('mousedown', _e => {
      if (this.toggleButton('button-microphone')) {
        this.audioVideo.realtimeUnmuteLocalAudio();
      } else {
        this.audioVideo.realtimeMuteLocalAudio();
      }
    });

    const buttonVideo = document.getElementById('button-camera');
    buttonVideo.addEventListener('click', _e => {
      new AsyncScheduler().start(async () => {
        if (this.toggleButton('button-camera') && this.canStartLocalVideo) {
          try {
            let camera: string = videoInput.value;
            if (videoInput.value === 'None') {
              camera = this.cameraDeviceIds.length ? this.cameraDeviceIds[0] : 'None';
            }
            await this.openVideoInputFromSelection(camera, false);
            this.audioVideo.startLocalVideoTile();
          } catch (err) {
            this.log('no video input device selected');
          }
        } else {
          this.audioVideo.stopLocalVideoTile();
          this.hideTile(16);
        }
      });
    });

    const buttonScreenShare = document.getElementById('button-screen-share');
    buttonScreenShare.addEventListener('click', () => {
      new AsyncScheduler().start(async () => {
        const button1 = 'button-screen-share';
        const button2 = 'button-pause-screen-share';
        if (this.buttonStates[button1]) {
          this.meetingSession.screenShare.stop()
            .catch(error => {
              this.log(error);
            })
            .finally(() => {
              this.buttonStates[button1] = false;
              this.buttonStates[button2] = false;
              this.displayButtonStates();
            });
        } else {
          const self = this;
          const observer: ScreenShareFacadeObserver = {
            didStopScreenSharing(): void {
              self.buttonStates[button1] = false;
              self.buttonStates[button2] = false;
              self.displayButtonStates();
            },
          };
          this.meetingSession.screenShare.registerObserver(observer);
          this.meetingSession.screenShare.start().then(() => {
            this.buttonStates[button1] = true;
            this.displayButtonStates();
          });
        }
      });
    });

    const buttonPauseScreenShare = document.getElementById('button-pause-screen-share');
    buttonPauseScreenShare.addEventListener('click', () => {
      new AsyncScheduler().start(async () => {
        const button = 'button-pause-screen-share';
        if (this.buttonStates[button]) {
          this.meetingSession.screenShare.unpause().then(() => {
            this.buttonStates[button] = false;
            this.displayButtonStates();
          });
        } else {
          const self = this;
          const observer: ScreenShareFacadeObserver = {
            didUnpauseScreenSharing(): void {
              self.buttonStates[button] = false;
              self.displayButtonStates();
            },
          };
          this.meetingSession.screenShare.registerObserver(observer);
          this.meetingSession.screenShare.pause().then(() => {
            this.buttonStates[button] = true;
            this.displayButtonStates();
          }).catch(error => {
            this.log(error);
          });
        }
      });
    });

    const buttonSpeaker = document.getElementById('button-speaker');
    buttonSpeaker.addEventListener('click', _e => {
      new AsyncScheduler().start(async () => {
        if (this.toggleButton('button-speaker')) {
          this.audioVideo.bindAudioElement(document.getElementById(
            'meeting-audio'
          ) as HTMLAudioElement);
        } else {
          this.audioVideo.unbindAudioElement();
        }
      });
    });

    const buttonScreenView = document.getElementById('button-screen-view');
    buttonScreenView.addEventListener('click', _e => {
      new AsyncScheduler().start(async () => {
        if (this.toggleButton('button-screen-view')) {
          const screenViewDiv = document.getElementById('tile-17') as HTMLDivElement;
          screenViewDiv.style.display = 'block';
          this.meetingSession.screenShareView.start(screenViewDiv);
        } else {
          this.meetingSession.screenShareView.stop()
            .catch(error => {
              this.log(error);
            })
            .finally(() => this.hideTile(17));
        }
        this.layoutVideoTiles();
      });
    });

    const buttonMeetingEnd = document.getElementById('button-meeting-end');
    buttonMeetingEnd.addEventListener('click', _e => {
      const confirmEnd = (new URL(window.location.href).searchParams.get('confirm-end')) === 'true';
      const prompt = 'Are you sure you want to end the meeting for everyone? The meeting cannot be used after ending it.';
      if (confirmEnd && !window.confirm(prompt)) {
        return;
      }
      new AsyncScheduler().start(async () => {
        (buttonMeetingEnd as HTMLButtonElement).disabled = true;
        await this.endMeeting();
        this.leave();
        (buttonMeetingEnd as HTMLButtonElement).disabled = false;
        // @ts-ignore
        //Rakesh window.location = window.location.pathname;
      });
    });

    const buttonMeetingLeave = document.getElementById('button-meeting-leave');
    buttonMeetingLeave.addEventListener('click', _e => {
      new AsyncScheduler().start(async () => {
        (buttonMeetingLeave as HTMLButtonElement).disabled = true;
        this.leave();
        (buttonMeetingLeave as HTMLButtonElement).disabled = false;
        // @ts-ignore
        //Rakesh window.location = window.location.pathname;
      });
    });
  }

  toggleButton(button: string, state?: 'on' | 'off'): boolean {
    if (state === 'on') {
      this.buttonStates[button] = true;
    } else if (state === 'off') {
      this.buttonStates[button] = false;
    } else {
      this.buttonStates[button] = !this.buttonStates[button];
    }
    this.displayButtonStates();
    return this.buttonStates[button];
  }

  displayButtonStates(): void {
    for (const button in this.buttonStates) {
      const element = document.getElementById(button);
      const drop = document.getElementById(`${button}-drop`);
      const on = this.buttonStates[button];
      element.classList.add(on ? 'btn-success' : 'btn-outline-secondary');
      element.classList.remove(on ? 'btn-outline-secondary' : 'btn-success');
      (element.firstElementChild as SVGElement).classList.add(on ? 'svg-active' : 'svg-inactive');
      (element.firstElementChild as SVGElement).classList.remove(
        on ? 'svg-inactive' : 'svg-active'
      );
      if (drop) {
        drop.classList.add(on ? 'btn-success' : 'btn-outline-secondary');
        drop.classList.remove(on ? 'btn-outline-secondary' : 'btn-success');
      }
    }
  }

  showProgress(id: string): void {
    (document.getElementById(id) as HTMLDivElement).style.visibility = 'visible';
  }

  hideProgress(id: string): void {
    (document.getElementById(id) as HTMLDivElement).style.visibility = 'hidden';
  }

  switchToFlow(flow: string): void {
    this.analyserNodeCallback = () => { };
    Array.from(document.getElementsByClassName('flow')).map(
      e => ((e as HTMLDivElement).style.display = 'none')
    );
    (document.getElementById(flow) as HTMLDivElement).style.display = 'block';
    //if (flow === 'flow-devices') {
    //  this.startAudioPreview();
    //}
  }
  readHtmlFile(file: string): string {
    var result = null;
    var htmlFile = new XMLHttpRequest();
    htmlFile.open("GET", file, false);
    htmlFile.send();
    if (htmlFile.status == 200) {
      result = htmlFile.responseText;
    }
    return result;
    // var xhr = new XMLHttpRequest();
    // xhr.onreadystatechange = function() {
    //   if (xhr.readyState == 4 && xhr.status == 200) {
    //     document.getElementById('placeholder').innerHTML = xhr.responseText;
    //   }
    // }
    // xhr.open('GET', 'test.html');
    // xhr.send();

  }


  setMeetingInfo(): void {
    new AsyncScheduler().start(
      async (): Promise<void> => {
        //this.showProgress('progress-authenticate');
	console.log('rakesh  setMeetingInfo ');
        try {
          await this.authenticate();
        } catch (error) {
          //(document.getElementById(
          //  'failed-meeting'
          //) as HTMLDivElement).innerHTML = `Meeting ID: ${this.meeting}`;
          //(document.getElementById('failed-meeting-error') as HTMLDivElement).innerHTML =
          //  error.message;
          //this.switchToFlow('flow-failed-meeting');
	this.log(error);
          return;
        }
        // (document.getElementById(
        //   'meeting-id'
        // ) as HTMLSpanElement).innerHTML = `${this.meeting} (${this.region})`;
        // (document.getElementById('info-meeting') as HTMLSpanElement).innerHTML = this.meeting;
        // (document.getElementById('info-name') as HTMLSpanElement).innerHTML = this.name;
        //this.switchToFlow('flow-devices');
        await this.openAudioInputFromSelection();
        try {
          await this.openVideoInputFromSelection(
            (document.getElementById('video-input') as HTMLSelectElement).value,
            true
          );
        } catch (err) {
          this.log('no video input device selected');
        }
        await this.openAudioOutputFromSelection();
        //this.hideProgress('progress-authenticate');
      }
    );
  }

  switchToCameraTab(): void {
    this.analyserNodeCallback = () => { };

    // var vconfigTab: any = $("#videoTabConfig li:eq(0) a");
    // var vTab: any = $("#videoTabConfig li:eq(1) a");
    // vTab.tab('show');
    // vconfigTab.addClass('disabled');
    // var vconfigTab: any = $("#videoTabConfig li:eq(0) a");
    // var vTab: any = $("#videoTabConfig li:eq(1) a");

    var vconfigTab: any = $("#videoTabConfig li:eq(0) a");
    var vTab: any = $("#videoTabConfig li:eq(1) a");


    vTab.tab('show');
    vTab.addClass('active');
    if (vTab.hasClass('disabled')) {
      vTab.removeClass('disabled');
    }

    vconfigTab.addClass('disabled');
    if (vconfigTab.hasClass('active')) {
      vconfigTab.removeClass('active');
    }
    var vconfigTabContent = $("#vConfig");
    var vCamContent = $("#vCam");

    if (vconfigTabContent.hasClass('active')) {
      vconfigTabContent.removeClass('active');
      vconfigTabContent.removeClass('show');
    }

    vCamContent.addClass('active');
    vCamContent.addClass('show');

  }

  switchTovConfigTab(): void {
    this.analyserNodeCallback = () => { };

    var vconfigTab: any = $("#videoTabConfig li:eq(0) a");
    var vTab: any = $("#videoTabConfig li:eq(1) a");



    vconfigTab.tab('show');
    vconfigTab.addClass('active');
    if (vconfigTab.hasClass('disabled')) {
      vconfigTab.removeClass('disabled');
    }

    vTab.addClass('disabled');
    if (vTab.hasClass('active')) {
      vTab.removeClass('active');
    }
    var vconfigTabContent = $("#vConfig");
    var vCamContent = $("#vCam");

    if (vCamContent.hasClass('active')) {
      vCamContent.removeClass('active');
      vCamContent.removeClass('show');
    }

    vconfigTabContent.addClass('active');
    vconfigTabContent.addClass('show');

  }



  audioInputsChanged(_freshAudioInputDeviceList: MediaDeviceInfo[]): void {
    this.populateAudioInputList();
  }

  videoInputsChanged(_freshVideoInputDeviceList: MediaDeviceInfo[]): void {
    this.populateVideoInputList();
  }

  audioOutputsChanged(_freshAudioOutputDeviceList: MediaDeviceInfo[]): void {
    this.populateAudioOutputList();
  }

  metricsDidReceive(clientMetricReport: ClientMetricReport): void {
    const metricReport = clientMetricReport.getObservableMetrics();
    if (typeof metricReport.availableSendBandwidth === 'number' && !isNaN(metricReport.availableSendBandwidth)) {
      (document.getElementById('video-uplink-bandwidth') as HTMLSpanElement).innerHTML =
        'Available Uplink Bandwidth: ' + String(metricReport.availableSendBandwidth / 1000) + ' Kbps';
    } else if (typeof metricReport.availableOutgoingBitrate === 'number' && !isNaN(metricReport.availableOutgoingBitrate)) {
      (document.getElementById('video-uplink-bandwidth') as HTMLSpanElement).innerHTML =
        'Available Uplink Bandwidth: ' + String(metricReport.availableOutgoingBitrate / 1000) + ' Kbps';
    } else {
      (document.getElementById('video-uplink-bandwidth') as HTMLSpanElement).innerHTML =
        'Available Uplink Bandwidth: Unknown';
    }

    if (typeof metricReport.availableReceiveBandwidth === 'number' && !isNaN(metricReport.availableReceiveBandwidth)) {
      (document.getElementById('video-downlink-bandwidth') as HTMLSpanElement).innerHTML =
        'Available Downlink Bandwidth: ' + String(metricReport.availableReceiveBandwidth / 1000) + ' Kbps';
    } else if (typeof metricReport.availableIncomingBitrate === 'number' && !isNaN(metricReport.availableIncomingBitrate)) {
      (document.getElementById('video-downlink-bandwidth') as HTMLSpanElement).innerHTML =
        'Available Downlink Bandwidth: ' + String(metricReport.availableIncomingBitrate / 1000) + ' Kbps';
    } else {
      (document.getElementById('video-downlink-bandwidth') as HTMLSpanElement).innerHTML =
        'Available Downlink Bandwidth: Unknown';
    }
  }

  async initializeMeetingSession(configuration: MeetingSessionConfiguration): Promise<void> {
    const logger = new ConsoleLogger('SDK', LogLevel.DEBUG);
    const deviceController = new DefaultDeviceController(logger);
	console.log('rakesh initializeMeetingSession 1');
    configuration.enableWebAudio = this.enableWebAudio;
	console.log('rakesh initializeMeetingSession 2');
    this.meetingSession = new DefaultMeetingSession(configuration, logger, deviceController);
	console.log('rakesh initializeMeetingSession 3');
    this.audioVideo = this.meetingSession.audioVideo;
	console.log('rakesh initializeMeetingSession 4');

    this.audioVideo.addDeviceChangeObserver(this);
    this.setupDeviceLabelTrigger();
    await this.populateAllDeviceLists();
    this.setupMuteHandler();
    this.setupCanUnmuteHandler();
    this.setupSubscribeToAttendeeIdPresenceHandler();
    this.setupScreenViewing();
    this.audioVideo.addObserver(this);
  }

  setClickHandler(elementId: string, f: () => void): void {
    document.getElementById(elementId).addEventListener('click', () => {
      f();
    });
  }

  async join(): Promise<void> {
    window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
      this.log(event.reason);
    });
    await this.openAudioInputFromSelection();
    await this.openAudioOutputFromSelection();
    this.audioVideo.start();
    await this.meetingSession.screenShare.open();
    await this.meetingSession.screenShareView.open();
  }

  leave(): void {
    this.meetingSession.screenShare
      .stop()
      .catch(() => { })
      .finally(() => {
        return this.meetingSession.screenShare.close();
      });
    this.meetingSession.screenShareView.close();
    this.audioVideo.stop();
    this.roster = {};

    this.switchTovConfigTab();

  }

  setupMuteHandler(): void {
    const handler = (isMuted: boolean): void => {
      this.log(`muted = ${isMuted}`);
    };
    this.audioVideo.realtimeSubscribeToMuteAndUnmuteLocalAudio(handler);
    const isMuted = this.audioVideo.realtimeIsLocalAudioMuted();
    handler(isMuted);
  }

  setupCanUnmuteHandler(): void {
    const handler = (canUnmute: boolean): void => {
      this.log(`canUnmute = ${canUnmute}`);
    };
    this.audioVideo.realtimeSubscribeToSetCanUnmuteLocalAudio(handler);
    handler(this.audioVideo.realtimeCanUnmuteLocalAudio());
  }

  updateRoster(): void {
    let rosterText = '';
    for (const attendeeId in this.roster) {
      rosterText +=
        '<li class="list-group-item d-flex justify-content-between align-items-center">';
      rosterText += this.roster[attendeeId].name;
      let score = this.roster[attendeeId].score;
      if (!score) {
        score = 0;
      }
      score = Math.floor(score * 100);
      if (score) {
        rosterText += ` (${score})`
      }
      rosterText += '<span class="badge badge-pill ';
      let status = '';
      if (this.roster[attendeeId].signalStrength < 1) {
        status = '&nbsp;';
        rosterText += 'badge-warning';
      } else if (this.roster[attendeeId].signalStrength === 0) {
        status = '&nbsp;';
        rosterText += 'badge-danger';
      } else if (this.roster[attendeeId].muted) {
        status = 'MUTED';
        rosterText += 'badge-secondary';
      } else if (this.roster[attendeeId].active) {
        status = 'SPEAKING';
        rosterText += 'badge-success';
      } else if (this.roster[attendeeId].volume > 0) {
        status = '&nbsp;';
        rosterText += 'badge-success';
      }
      rosterText += `">${status}</span></li>`;
    }
    const roster = document.getElementById('roster');
    if (roster.innerHTML !== rosterText) {
      roster.innerHTML = rosterText;
    }
  }

  setupSubscribeToAttendeeIdPresenceHandler(): void {
    const handler = (attendeeId: string, present: boolean): void => {
      this.log(`${attendeeId} present = ${present}`);
      if (!present) {
        delete this.roster[attendeeId];
        this.updateRoster();
        return;
      }
      this.audioVideo.realtimeSubscribeToVolumeIndicator(
        attendeeId,
        async (
          attendeeId: string,
          volume: number | null,
          muted: boolean | null,
          signalStrength: number | null
        ) => {
          if (!this.roster[attendeeId]) {
            this.roster[attendeeId] = { name: '' };
          }
          if (volume !== null) {
            this.roster[attendeeId].volume = Math.round(volume * 100);
          }
          if (muted !== null) {
            this.roster[attendeeId].muted = muted;
          }
          if (signalStrength !== null) {
            this.roster[attendeeId].signalStrength = Math.round(signalStrength * 100);
          }
          if (!this.roster[attendeeId].name) {
            const response = await fetch(`${eTreatApp.BASE_URL}attendee?title=${encodeURIComponent(this.meeting)}&attendee=${encodeURIComponent(attendeeId)}`);
            const json = await response.json();
            const name = json.AttendeeInfo.Name;
            this.roster[attendeeId].name = name ? name : '';
          }
          this.updateRoster();
        }
      );
    };
    this.audioVideo.realtimeSubscribeToAttendeeIdPresence(handler);
    const activeSpeakerHandler = (attendeeIds: string[]): void => {
      for (const attendeeId in this.roster) {
        this.roster[attendeeId].active = false;
      }
      for (const attendeeId of attendeeIds) {
        if (this.roster[attendeeId]) {
          this.roster[attendeeId].active = true;
          break; // only show the most active speaker
        }
      }
      this.layoutVideoTiles();
    };
    this.audioVideo.subscribeToActiveSpeakerDetector(
      new DefaultActiveSpeakerPolicy(),
      activeSpeakerHandler,
      (scores: { [attendeeId: string]: number }) => {
        for (const attendeeId in scores) {
          if (this.roster[attendeeId]) {
            this.roster[attendeeId].score = scores[attendeeId];
          }
        }
        this.updateRoster();
      },
      this.showActiveSpeakerScores ? 100 : 0,
    );
  }

  // eslint-disable-next-line
  async joinMeeting(): Promise<any> {
    const response = await fetch(
      `${eTreatApp.BASE_URL}join?title=${encodeURIComponent(this.meeting)}&name=${encodeURIComponent(this.name)}&region=${encodeURIComponent(this.region)}`,
      {
        method: 'POST',
      }
    );
    const json = await response.json();
    if (json.error) {
      throw new Error(`Server error: ${json.error}`);
    }
    return json;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async endMeeting(): Promise<any> {
    await fetch(`${eTreatApp.BASE_URL}end?title=${encodeURIComponent(this.meeting)}`, {
      method: 'POST',
    });

    this.switchTovConfigTab();

  }

  setupDeviceLabelTrigger(): void {
    // Note that device labels are privileged since they add to the
    // fingerprinting surface area of the browser session. In Chrome private
    // tabs and in all Firefox tabs, the labels can only be read once a
    // MediaStream is active. How to deal with this restriction depends on the
    // desired UX. The device controller includes an injectable device label
    // trigger which allows you to perform custom behavior in case there are no
    // labels, such as creating a temporary audio/video stream to unlock the
    // device names, which is the default behavior. Here we override the
    // trigger to also show an alert to let the user know that we are asking for
    // mic/camera permission.
    //
    // Also note that Firefox has its own device picker, which may be useful
    // for the first device selection. Subsequent device selections could use
    // a custom UX with a specific device id.
    this.audioVideo.setDeviceLabelTrigger(
      async (): Promise<MediaStream> => {
        //this.switchToFlow('flow-need-permission');
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        this.switchToFlow('flow-center-info');
        return stream;
      }
    );
  }

  setupDeviceLabelTrigger_my(): void {
    this.audioVideo.setDeviceLabelTrigger(
      async (): Promise<MediaStream> => {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        return stream;
      }
    );
  }

  populateDeviceList(
    elementId: string,
    genericName: string,
    devices: MediaDeviceInfo[],
    additionalOptions: string[]
  ): void {
    const list = document.getElementById(elementId) as HTMLSelectElement;
    while (list.firstElementChild) {
      list.removeChild(list.firstElementChild);
    }
    for (let i = 0; i < devices.length; i++) {
      const option = document.createElement('option');
      list.appendChild(option);
      option.text = devices[i].label || `${genericName} ${i + 1}`;
      option.value = devices[i].deviceId;
    }
    if (additionalOptions.length > 0) {
      const separator = document.createElement('option');
      separator.disabled = true;
      separator.text = '──────────';
      list.appendChild(separator);
      for (const additionalOption of additionalOptions) {
        const option = document.createElement('option');
        list.appendChild(option);
        option.text = additionalOption;
        option.value = additionalOption;
      }
    }
    if (!list.firstElementChild) {
      const option = document.createElement('option');
      option.text = 'Device selection unavailable';
      list.appendChild(option);
    }
  }

  populateInMeetingDeviceList(
    elementId: string,
    genericName: string,
    devices: MediaDeviceInfo[],
    additionalOptions: string[],
    callback: (name: string) => void
  ): void {
    const menu = document.getElementById(elementId) as HTMLDivElement;
    while (menu.firstElementChild) {
      menu.removeChild(menu.firstElementChild);
    }
    for (let i = 0; i < devices.length; i++) {
      this.createDropdownMenuItem(menu, devices[i].label || `${genericName} ${i + 1}`, () => {
        callback(devices[i].deviceId);
      });
    }
    if (additionalOptions.length > 0) {
      this.createDropdownMenuItem(menu, '──────────', () => { }).classList.add('text-center');
      for (const additionalOption of additionalOptions) {
        this.createDropdownMenuItem(
          menu,
          additionalOption,
          () => {
            callback(additionalOption);
          },
          `${elementId}-${additionalOption.replace(/\s/g, '-')}`
        );
      }
    }
    if (!menu.firstElementChild) {
      this.createDropdownMenuItem(menu, 'Device selection unavailable', () => { });
    }
  }

  createDropdownMenuItem(
    menu: HTMLDivElement,
    title: string,
    clickHandler: () => void,
    id?: string
  ): HTMLButtonElement {
    const button = document.createElement('button') as HTMLButtonElement;
    menu.appendChild(button);
    button.innerHTML = title;
    button.classList.add('dropdown-item');
    if (id !== undefined) {
      button.id = id;
    }
    button.addEventListener('click', () => {
      clickHandler();
    });
    return button;
  }

  async populateAllDeviceLists(): Promise<void> {
    await this.populateAudioInputList();
    await this.populateVideoInputList();
    await this.populateAudioOutputList();
  }

  async populateAudioInputList(): Promise<void> {
    const genericName = 'Microphone';
    const additionalDevices = ['None', '440 Hz'];
    this.populateDeviceList(
      'audio-input',
      genericName,
      await this.audioVideo.listAudioInputDevices(),
      additionalDevices
    );
    this.populateInMeetingDeviceList(
      'dropdown-menu-microphone',
      genericName,
      await this.audioVideo.listAudioInputDevices(),
      additionalDevices,
      async (name: string) => {
        await this.audioVideo.chooseAudioInputDevice(this.audioInputSelectionToDevice(name));
      }
    );
  }

  async populateVideoInputList(): Promise<void> {
    const genericName = 'Camera';
    const additionalDevices = ['None', 'Blue', 'SMPTE Color Bars'];
    this.populateDeviceList(
      'video-input',
      genericName,
      await this.audioVideo.listVideoInputDevices(),
      additionalDevices
    );
    this.populateInMeetingDeviceList(
      'dropdown-menu-camera',
      genericName,
      await this.audioVideo.listVideoInputDevices(),
      additionalDevices,
      async (name: string) => {
        try {
          await this.openVideoInputFromSelection(name, false);
        } catch (err) {
          this.log('no video input device selected');
        }
      }
    );
    const cameras = await this.audioVideo.listVideoInputDevices();
    this.cameraDeviceIds = cameras.map((deviceInfo) => {
      return deviceInfo.deviceId;
    });
  }

  async populateAudioOutputList(): Promise<void> {
    const genericName = 'Speaker';
    const additionalDevices: string[] = [];
    this.populateDeviceList(
      'audio-output',
      genericName,
      await this.audioVideo.listAudioOutputDevices(),
      additionalDevices
    );
    this.populateInMeetingDeviceList(
      'dropdown-menu-speaker',
      genericName,
      await this.audioVideo.listAudioOutputDevices(),
      additionalDevices,
      async (name: string) => {
        await this.audioVideo.chooseAudioOutputDevice(name);
      }
    );
  }

  private analyserNodeCallback = () => { };

  async openAudioInputFromSelection(): Promise<void> {
    const audioInput = document.getElementById('audio-input') as HTMLSelectElement;
    await this.audioVideo.chooseAudioInputDevice(
      this.audioInputSelectionToDevice(audioInput.value)
    );
    this.startAudioPreview();
  }

  setAudioPreviewPercent(percent: number): void {
    const audioPreview = document.getElementById('audio-preview');
    if (audioPreview.getAttribute('aria-valuenow') !== `${percent}`) {
      audioPreview.style.width = `${percent}%`;
      audioPreview.setAttribute('aria-valuenow', `${percent}`);
    }
    const transitionDuration = '33ms';
    if (audioPreview.style.transitionDuration !== transitionDuration) {
      audioPreview.style.transitionDuration = transitionDuration;
    }
  }

  startAudioPreview(): void {
    this.setAudioPreviewPercent(0);
    const analyserNode = this.audioVideo.createAnalyserNodeForAudioInput();
    if (!analyserNode) {
      return;
    }
    if (!analyserNode.getFloatTimeDomainData) {
      document.getElementById('audio-preview').parentElement.style.visibility = 'hidden';
      return;
    }
    const data = new Float32Array(analyserNode.fftSize);
    let frameIndex = 0;
    this.analyserNodeCallback = () => {
      if (frameIndex === 0) {
        analyserNode.getFloatTimeDomainData(data);
        const lowest = 0.01;
        let max = lowest;
        for (const f of data) {
          max = Math.max(max, Math.abs(f));
        }
        let normalized = (Math.log(lowest) - Math.log(max)) / Math.log(lowest);
        let percent = Math.min(Math.max(normalized * 100, 0), 100);
        this.setAudioPreviewPercent(percent);
      }
      frameIndex = (frameIndex + 1) % 2;
      requestAnimationFrame(this.analyserNodeCallback);
    };
    requestAnimationFrame(this.analyserNodeCallback);
  }

  async openAudioOutputFromSelection(): Promise<void> {
    const audioOutput = document.getElementById('audio-output') as HTMLSelectElement;
    await this.audioVideo.chooseAudioOutputDevice(audioOutput.value);
    const audioMix = document.getElementById('meeting-audio') as HTMLAudioElement;
    await this.audioVideo.bindAudioElement(audioMix);
  }

  private selectedVideoInput: string | null = null;

  async openVideoInputFromSelection(selection: string | null, showPreview: boolean): Promise<void> {
    if (selection) {
      this.selectedVideoInput = selection;
    }
    this.log(`Switching to: ${this.selectedVideoInput}`);
    const device = this.videoInputSelectionToDevice(this.selectedVideoInput);
    if (device === null) {
      if (showPreview) {
        this.audioVideo.stopVideoPreviewForVideoInput(document.getElementById(
          'video-preview'
        ) as HTMLVideoElement);
      }
      this.audioVideo.stopLocalVideoTile();
      this.toggleButton('button-camera', 'off');
      // choose video input null is redundant since we expect stopLocalVideoTile to clean up
      await this.audioVideo.chooseVideoInputDevice(device);
      throw new Error('no video device selected');
    }
    await this.audioVideo.chooseVideoInputDevice(device);
    if (showPreview) {
      this.audioVideo.startVideoPreviewForVideoInput(document.getElementById(
        'video-preview'
      ) as HTMLVideoElement);
    }
  }

  private audioInputSelectionToDevice(value: string): Device {
    if (value === '440 Hz') {
      return DefaultDeviceController.synthesizeAudioDevice(440);
    } else if (value === 'None') {
      return null;
    }
    return value;
  }

  private videoInputSelectionToDevice(value: string): Device {
    if (value === 'Blue') {
      return DefaultDeviceController.synthesizeVideoDevice('blue');
    } else if (value === 'SMPTE Color Bars') {
      return DefaultDeviceController.synthesizeVideoDevice('smpte');
    } else if (value === 'None') {
      return null;
    }
    return value;
  }

  async authenticate(): Promise<void> {
    let joinInfo = (await this.joinMeeting()).JoinInfo;
console.log('rakesh authenticate ');
    await this.initializeMeetingSession(
      new MeetingSessionConfiguration(joinInfo.Meeting, joinInfo.Attendee)
    );
    const url = new URL(window.location.href);
    url.searchParams.set('m', this.meeting);
    history.replaceState({}, `${this.meeting}`, url.toString());
  }

  log(str: string): void {
    console.log(`[DEMO] ${str}`);
  }

  audioVideoDidStartConnecting(reconnecting: boolean): void {
    this.log(`session connecting. reconnecting: ${reconnecting}`);
  }

  audioVideoDidStart(): void {
    this.log('session started');
  }

  audioVideoDidStop(sessionStatus: MeetingSessionStatus): void {
    this.log(`session stopped from ${JSON.stringify(sessionStatus)}`);
    if (sessionStatus.statusCode() === MeetingSessionStatusCode.AudioCallEnded) {
      this.log(`meeting ended`);
      // @ts-ignore
      window.location = window.location.pathname;
    }
  }

  videoTileDidUpdate(tileState: VideoTileState): void {
    this.log(`video tile updated: ${JSON.stringify(tileState, null, '  ')}`);
    const tileIndex = tileState.localTile
      ? 16
      : this.tileOrganizer.acquireTileIndex(tileState.tileId);
    const tileElement = document.getElementById(`tile-${tileIndex}`) as HTMLDivElement;
    const videoElement = document.getElementById(`video-${tileIndex}`) as HTMLVideoElement;
    const nameplateElement = document.getElementById(`nameplate-${tileIndex}`) as HTMLDivElement;
    this.log(`binding video tile ${tileState.tileId} to ${videoElement.id}`);
    this.audioVideo.bindVideoElement(tileState.tileId, videoElement);
    this.tileIndexToTileId[tileIndex] = tileState.tileId;
    this.tileIdToTileIndex[tileState.tileId] = tileIndex;
    // TODO: enforce roster names
    new TimeoutScheduler(200).start(() => {
      const rosterName = this.roster[tileState.boundAttendeeId]
        ? this.roster[tileState.boundAttendeeId].name
        : '';
      if (nameplateElement.innerHTML !== rosterName) {
        nameplateElement.innerHTML = rosterName;
      }
    });
    tileElement.style.display = 'block';
    this.layoutVideoTiles();
  }

  videoTileWasRemoved(tileId: number): void {
    this.log(`video tile removed: ${tileId}`);
    this.hideTile(this.tileOrganizer.releaseTileIndex(tileId));
  }

  videoAvailabilityDidChange(availability: MeetingSessionVideoAvailability): void {
    this.canStartLocalVideo = availability.canStartLocalVideo;
    this.log(`video availability changed: canStartLocalVideo  ${availability.canStartLocalVideo}`);
  }

  hideTile(tileIndex: number): void {
    const tileElement = document.getElementById(`tile-${tileIndex}`) as HTMLDivElement;
    tileElement.style.display = 'none';
    this.layoutVideoTiles();
  }

  tileIdForAttendeeId(attendeeId: string): number | null {
    for (const tile of this.audioVideo.getAllVideoTiles()) {
      const state = tile.state();
      if (state.boundAttendeeId === attendeeId) {
        return state.tileId;
      }
    }
    return null;
  }

  activeTileId(): number | null {
    for (const attendeeId in this.roster) {
      if (this.roster[attendeeId].active) {
        return this.tileIdForAttendeeId(attendeeId);
      }
    }
    return null;
  }

  layoutVideoTiles(): void {
    if (!this.meetingSession) {
      return;
    }
    const selfAttendeeId = this.meetingSession.configuration.credentials.attendeeId;
    const selfTileId = this.tileIdForAttendeeId(selfAttendeeId);
    const visibleTileIndices = this.visibleTileIndices();
    let activeTileId = this.activeTileId();
    const selfIsVisible = visibleTileIndices.includes(this.tileIdToTileIndex[selfTileId]);
    if (visibleTileIndices.length === 2 && selfIsVisible) {
      activeTileId = this.tileIndexToTileId[
        visibleTileIndices[0] === selfTileId ? visibleTileIndices[1] : visibleTileIndices[0]
      ];
    }
    const hasVisibleActiveSpeaker = visibleTileIndices.includes(
      this.tileIdToTileIndex[activeTileId]
    );
    if (this.activeSpeakerLayout && hasVisibleActiveSpeaker) {
      this.layoutVideoTilesActiveSpeaker(visibleTileIndices, activeTileId);
    } else {
      this.layoutVideoTilesGrid(visibleTileIndices);
    }
  }

  visibleTileIndices(): number[] {
    let tiles: number[] = [];
    const screenViewTileIndex = 17;
    for (let tileIndex = 0; tileIndex <= screenViewTileIndex; tileIndex++) {
      const tileElement = document.getElementById(`tile-${tileIndex}`) as HTMLDivElement;
      if (tileElement.style.display === 'block') {
        if (tileIndex === screenViewTileIndex) {
          // Hide videos when viewing screen
          for (const tile of tiles) {
            const tileToSuppress = document.getElementById(`tile-${tile}`) as HTMLDivElement;
            tileToSuppress.style.visibility = 'hidden';
          }
          tiles = [screenViewTileIndex];
        } else {
          tiles.push(tileIndex);
        }
      }
    }
    return tiles;
  }

  layoutVideoTilesActiveSpeaker(visibleTileIndices: number[], activeTileId: number): void {
    const tileArea = document.getElementById('tile-area') as HTMLDivElement;
    const width = tileArea.clientWidth;
    const height = tileArea.clientHeight;
    const widthToHeightAspectRatio = 16 / 9;
    const maximumRelativeHeightOfOthers = 0.3;

    const activeWidth = width;
    const activeHeight = width / widthToHeightAspectRatio;
    const othersCount = visibleTileIndices.length - 1;
    let othersWidth = width / othersCount;
    let othersHeight = width / widthToHeightAspectRatio;
    if (othersHeight / activeHeight > maximumRelativeHeightOfOthers) {
      othersHeight = activeHeight * maximumRelativeHeightOfOthers;
      othersWidth = othersHeight * widthToHeightAspectRatio;
    }
    if (othersCount === 0) {
      othersHeight = 0;
    }
    const totalHeight = activeHeight + othersHeight;
    const othersTotalWidth = othersWidth * othersCount;
    const othersXOffset = width / 2 - othersTotalWidth / 2;
    const activeYOffset = height / 2 - totalHeight / 2;
    const othersYOffset = activeYOffset + activeHeight;

    let othersIndex = 0;
    for (let i = 0; i < visibleTileIndices.length; i++) {
      const tileIndex = visibleTileIndices[i];
      const tileId = this.tileIndexToTileId[tileIndex];
      let x = 0,
        y = 0,
        w = 0,
        h = 0;
      if (tileId === activeTileId) {
        x = 0;
        y = activeYOffset;
        w = activeWidth;
        h = activeHeight;
      } else {
        x = othersXOffset + othersIndex * othersWidth;
        y = othersYOffset;
        w = othersWidth;
        h = othersHeight;
        othersIndex += 1;
      }
      this.updateTilePlacement(tileIndex, x, y, w, h);
    }
  }

  updateTilePlacement(tileIndex: number, x: number, y: number, w: number, h: number): void {
    const tile = document.getElementById(`tile-${tileIndex}`) as HTMLDivElement;
    const insetWidthSize = 4;
    const insetHeightSize = insetWidthSize / (16 / 9);
    tile.style.position = 'absolute';
    tile.style.left = `${x + insetWidthSize}px`;
    tile.style.top = `${y + insetHeightSize}px`;
    tile.style.width = `${w - insetWidthSize * 2}px`;
    tile.style.height = `${h - insetHeightSize * 2}px`;
    tile.style.margin = '0';
    tile.style.padding = '0';
    tile.style.visibility = 'visible';
    const video = document.getElementById(`video-${tileIndex}`) as HTMLDivElement;
    if (video) {
      video.style.position = 'absolute';
      video.style.left = '0';
      video.style.top = '0';
      video.style.width = `${w}px`;
      video.style.height = `${h}px`;
      video.style.margin = '0';
      video.style.padding = '0';
      video.style.borderRadius = '8px';
    }
    const nameplate = document.getElementById(`nameplate-${tileIndex}`) as HTMLDivElement;
    const nameplateSize = 24;
    const nameplatePadding = 10;
    nameplate.style.position = 'absolute';
    nameplate.style.left = '0px';
    nameplate.style.top = `${h - nameplateSize - nameplatePadding}px`;
    nameplate.style.height = `${nameplateSize}px`;
    nameplate.style.width = `${w}px`;
    nameplate.style.margin = '0';
    nameplate.style.padding = '0';
    nameplate.style.paddingLeft = `${nameplatePadding}px`;
    nameplate.style.color = '#fff';
    nameplate.style.backgroundColor = 'rgba(0,0,0,0)';
    nameplate.style.textShadow = '0px 0px 5px black';
    nameplate.style.letterSpacing = '0.1em';
    nameplate.style.fontSize = `${nameplateSize - 6}px`;
  }

  layoutVideoTilesGrid(visibleTileIndices: number[]): void {
    const tileArea = document.getElementById('tile-area') as HTMLDivElement;
    const width = tileArea.clientWidth;
    const height = tileArea.clientHeight;
    const widthToHeightAspectRatio = 16 / 9;
    let columns = 1;
    let totalHeight = 0;
    let rowHeight = 0;
    for (; columns < 18; columns++) {
      const rows = Math.ceil(visibleTileIndices.length / columns);
      rowHeight = width / columns / widthToHeightAspectRatio;
      totalHeight = rowHeight * rows;
      if (totalHeight <= height) {
        break;
      }
    }
    for (let i = 0; i < visibleTileIndices.length; i++) {
      const w = Math.floor(width / columns);
      const h = Math.floor(rowHeight);
      const x = (i % columns) * w;
      const y = Math.floor(i / columns) * h + (height / 2 - totalHeight / 2);
      this.updateTilePlacement(visibleTileIndices[i], x, y, w, h);
    }
  }

  private setupScreenViewing(): void {
    const self = this;
    this.meetingSession.screenShareView.registerObserver({
      streamDidStart(screenMessageDetail: ScreenMessageDetail): void {
        const rosterEntry = self.roster[screenMessageDetail.attendeeId];
        document.getElementById('nameplate-17').innerHTML = rosterEntry ? rosterEntry.name : '';
      },
      streamDidStop(_screenMessageDetail: ScreenMessageDetail): void {
        document.getElementById('nameplate-17').innerHTML = 'No one is sharing screen';
      },
    });
  }

  connectionDidBecomePoor(): void {
    this.log('connection is poor');
  }

  connectionDidSuggestStopVideo(): void {
    this.log('suggest turning the video off');
  }

  videoSendDidBecomeUnavailable(): void {
    this.log('sending video is not available');
  }

  async loadPatientList_db(): Promise<void> {

    var patient_list: any = null;

    this.getAllPatients()
      .then((json) => {
        console.log(json);
        patient_list = json;

        console.log("list from server 1= " + patient_list);

        $(document).ready(() => {

          $('#bs-example').DataTable({
            "data": patient_list,
            "pageLength": 10,
            "columns": [
              { "data": "ID" },
              { "data": "Patient Name" },
              { "data": "Date of Birth" },
              { "data": "Date of Service" },
              { "data": "Facility" },
              {
                "data": function(ID: any) {
                  // return "<a href=Test</a>";
                  return "<button type=\"button\" class=\"btn btn-primary btn-sm dt-edit\" style=\"margin-right:16px; fontSize=\"11px\";\"> <span class=\"fas fa-edit\" aria-hidden=\"true\"></span>";
                }
              }
            ]
          });

          this.setPatientListDetailBtns(patient_list);
        }); //document ready

      }); //getAllPatient then
  }

  setPatientListDetailBtns(patient_list: any): void {
    console.log('rakesh  setPatientList Buttons');
    $('.dt-edit').each(function() {
      $(this).on('click', function(evt) {

        var dtRow = $(this).parents('tr');


        var field0 = dtRow.children()[0].innerText;
        var field1 = dtRow.children()[1].innerText;
        var field2 = dtRow.children()[2].innerText;
        var field3 = dtRow.children()[3].innerText;
        var field4 = dtRow.children()[4].innerText;

        document.getElementById('name-plate').innerHTML = field1;

        var field5: string = '';
        var field6: string = '';
        var field7: string = '';
        var field8: string = '';
        var field9: string = '';
        var field10: string = '';
        var field11: string = '';
        var field12: string = '';
        var field13: string = '';

        for (var i = 0; i < patient_list.length; i++) {
          if (patient_list[i].ID == Number(field0)) {
            field5 = patient_list[i]["Chief Complaint"];
            field6 = patient_list[i]["HPI"];
            field7 = patient_list[i]["Interval History"];
            field8 = patient_list[i]["Review Of Systems"];
            field9 = patient_list[i]["Past Medical History"];
            field10 = patient_list[i]["Medications"];
            field11 = patient_list[i]["Physical Examination"];
            field12 = patient_list[i]["Assessment"];
            field13 = patient_list[i]["Plan"];
          }

        };


        var pDetailsFbody: any = $("#pDetailsF");
        var bdy: string = `
    <div>
    <form class=\"border-info\">
    <div class=\"form-group\">

    <div class=\"row pt-2\">
      <label for=\"patient-id\" class=\"col-md-3\">ID:</label>
      <input type=\"text\" class=\"form-control col-md-7\" id=\"patient-id\" value="` + field0 + `"></input>
    </div>

    <div class=\"row pt-2\">
      <label for=\"patient-name\" class=\"col-md-3\">Name:</label>
      <input class=\"form-control col-md-7\" id=\"patient-name\" value="` + field1 + `"></input>
    </div>

    <div class=\"row pt-2\">
      <label for=\"patient-DOB\" class=\"col-md-3\">Date Of Birth:</label>
      <input class=\"form-control col-md-7\" id=\"patient-DOB\" value="` + field2 + `"></input>
    </div>

    <div class=\"row pt-2\">
      <label for=\"patient-DOS\" class=\"col-md-3\">Date of Service:</label>
      <input class=\"form-control col-md-7\" id=\"patient-DOS\" value="` + field3 + `"></input>
    </div>

    <div class=\"row pt-2\">
      <label for=\"patient-facility\" class=\"col-md-3\">Facility:</label>
      <input class=\"form-control col-md-7\" id=\"patient-facility\" value="` + field4 + `"></input>
    </div>

    <div class=\"row pt-2\">
      <label for=\"patient-comp\" class=\"col-md-3\">Chief Complaint:</label>
      <textarea rows=\"7\" class=\"form-control col-md-7\" id=\"patient-comp\">` + field5 + `</textarea>
    </div>

    <div class=\"row pt-2\">
      <label for=\"patient-HPI\" class=\"col-md-3\">HPI:</label>
      <textarea rows=\"7\" class=\"form-control col-md-7\" id=\"patient-HPI\">` + field6 + `</textarea>
    </div>

    <div class=\"row pt-2\">
      <label for=\"patient-IH\" class=\"col-md-3\">Interval History:</label>
      <textarea rows=\"7\" class=\"form-control col-md-7\" id=\"patient-IH\">` + field7 + `</textarea>
    </div>

    <div class=\"row pt-2\">
      <label for=\"patient-RS\" class=\"col-md-3\">Review Of Systems:</label>
      <textarea rows=\"7\" class=\"form-control col-md-7\" id=\"patient-RS\">` + field8 + `</textarea>
    </div>

    <div class=\"row pt-2\">
      <label for=\"patient-PMH\" class=\"col-md-3\">Past Medical History:</label>
      <textarea rows=\"7\" class=\"form-control col-md-7\" id=\"patient-PMH\">` + field9 + `</textarea>
    </div>

    <div class=\"row pt-2\">
      <label for=\"patient-Med\" class=\"col-md-3\">Medications:</label>
      <textarea rows=\"7\" class=\"form-control col-md-7\" id=\"patient-Med\">` + field10 + `</textarea>
    </div>

    <div class=\"row pt-2\">
      <label for=\"patient-PE\" class=\"col-md-3\">Physical Examination:</label>
      <textarea rows=\"7\" class=\"form-control col-md-7\" id=\"patient-PE\">` + field11 + `</textarea>
    </div>

    <div class=\"row pt-2\">
      <label for=\"patient-assmt\" class=\"col-md-3\">Assessment:</label>
      <textarea rows=\"7\" class=\"form-control col-md-7\" id=\"patient-assmt\">` + field12 + `</textarea>
    </div>

    <div class=\"row pt-2\">
      <label for=\"patient-paln\" class=\"col-md-3\">Plan:</label>
      <textarea rows=\"7\" class=\"form-control col-md-7\" id=\"patient-plan\">` + field13 + `</textarea>
    </div>

    </div>

    </form>
    <div class="row justify-content-center">
      <button type=\"button\" class=\"btn btn-primary\">Save</button>
    </div>
    </div>
    `;

        pDetailsFbody.html(bdy);
        var pdTab: any = $("#patientTabList li:eq(1) a");
        pdTab.tab('show');

      });
    });
  }

  loadPatientList(): void {

    var patient_list = [
      {
        "ID": 1,
        "Patient Name": "Koetscha, Bernard",
        "Date of Birth": "8/14/1947",
        "Date of Service": "11/18/2019",
        "Facility": "Chamberlain Healthcare Manor",
        "Chief Complaint": "Neuromuscular weakness and ADL dysfunction secondary to the presence of left artificial hip joint.",
        "HPI": "The patient was seen and examined today. \n\nThe patient states that physical therapy seems to be going pretty good.",
        "Interval History": "The patient is tolerating therapies but continues to have declined in function/weakness. Continues to work with therapy team to regain to prior level of function and independence for safe discharge.  PM&R to continue to monitor progress and evaluate for further rehabilitation needs and recommendations.",
        "Review Of Systems": "(Gained from chart review, interview of patient and (or) family and discussion with staff): As per HPI above. Otherwise, 12 systems were reviewed and were negative",
        "Past Medical History": "BPH, bipolar, hypercholesteremia, benign essential tremor, CVA, PVD, depression, Afib, CAD, MI s/p stents, arthritis, s/p R THR.",
        "Medications": "As per MAR (reviewed pertinent medications today)",
        "Physical Examination": "Vital Signs: VSS-R\nGeneral Appearance: NAD, well-groomed\nHEENT: Normocephalic, EOMI, supple neck, post pharynx normal\nRespiratory: Unlabored, no cough \nCardiovascular: RRR, S1/S2\nPsychological: Alert, and cooperative\nGI: +bowel sounds, S/NT/ND\nComprehensive MSK (Skeletal): The patient has decreased ROM in the LLE at the hip secondary to joint replacement, both passive and active. Right is intact in full ROM. Muscle tone and sensation are intact. No LE edema. Proprioception is intact. Has abnormal gait during ambulation. Has 3/5 strength of LE and 4/5 strength of UE.\nNeurological: CN 7 and CN 11 checked and intact.\nReflexes: 2+ and symmetrical in bilateral upper and lower extremities\nSkin: No heel ulcers\nExt: No edema, no calf tenderness, pedal pulses present",
        "Assessment": "1. R53.81 ADL and mobility dysfunction\n2. M62.81 Neuromuscular weakness and de-conditioning\n3. R26.81 Gait Instability\n4. Z96.642 Presence of left artificial hip joint\n1. R53.81 ADL and mobility dysfunction\n2. M62.81 Neuromuscular weakness and de-conditioning\n3. R26.81 Gait Instability\n4. Z96.642 Presence of left artificial hip joint\n1. R53.81 ADL and mobility dysfunction\n2. M62.81 Neuromuscular weakness and de-conditioning\n3. R26.81 Gait Instability\n4. Z96.642 Presence of left artificial hip joint",
        "Plan": "1. Medical necessity for rehabilitation: Continues to have declined in function/weakness. Continue working on quad sets, ankle pumps and transfers.\n2. Current level of function: Amb 15'x2, 40', 60' with CGA and RW; sit/stand with vc's for hand placements from elevated surfaces; \n3. Care team coordination: Discussed with therapy team; continue therapy per orders\n4. Follow-up: Physiatry will follow-up and reassess patient in 2-5 days and/or more frequently as needed as deemed per primary team/rehabilitation team/nursing.  Goal of follow-up visits will be to reassess any decline in function, review therapy evaluations and notes, diagnose any current/new/or potential barriers to rehabilitation, and maintain appropriateness of patient’s progression in therapies. Barriers to rehabilitation may prevent a safe and timely discharge of patient; and goal of Physiatry oversight is to maintain safe and timely discharge of patient’s overall admission in nursing facility setting to discharge setting.  During follow-up visits, Physiatry will re-order certifications for continued therapies."
      },
      {
        "ID": 2,
        "Patient Name": "Sherbacka, Joyce",
        "Date of Birth": "10/26/1943",
        "Date of Service": "11/18/2019",
        "Facility": "Chamberlain Healthcare Manor",
        "Chief Complaint": "Neuromuscular weakness and ADL dysfunction secondary to unspecified subluxation of right hip, subsequent encounter, unspecified injury of right hip, subsequent encounter",
        "HPI": "The patient was seen and examined today. \n\nThe patient states that physical therapy seems to be going well.",
        "Interval History": "The patient is tolerating therapies but continues to have declined in function/weakness, difficulty walking. Continues to work with therapy team to regain to prior level of function and independence for safe discharge.  PM&R to continue to monitor progress and evaluate for further rehabilitation needs and recommendations.",
        "Review Of Systems": "(Gained from chart review, interview of patient and (or) family and discussion with staff): As per HPI above. Otherwise, 12 systems were reviewed and were negative.",
        "Past Medical History": "Cystocele, glaucoma, HTN, hx chemotherapy, active smoker, \" mild mental retardation\", left breast Ca, hydronephrosis, closed nondisplaced fx of shaft of left clavicle, wrist fx, cataract extraction w/intraocular lens implant, simple mastectomy, sentinel lymph node biopsy, eye surgery, US-guided breast biopsy, lymph node dissection/axillary node dissection.",
        "Medications": "As per MAR (reviewed pertinent medications today)",
        "Physical Examination": "Vital Signs: VSS-R\nGeneral Appearance: NAD, well-groomed\nHEENT: Normocephalic, EOMI, supple neck, post pharynx normal\nRespiratory: Unlabored, no cough\nCardiovascular: RRR, S1/S2\nPsychological: Alert, and cooperative\nGI: +bowel sounds, S/NT/ND\nComprehensive MSK (Skeletal): The patient has decreased ROM of the right hip secondary to dislocation. Flexion and extension, adduction and abduction. Has abnormal gait during ambulation. Has 3/5 strength of LE and 3/5 strength of UE. No LE edema.\nNeurological: CN 7 and CN 11 checked and intact.\nReflexes: 2+ and symmetrical in bilateral upper and lower extremities\nSkin: No heel ulcers\nExt: No edema, no calf tenderness, pedal pulses present",
        "Assessment": "1. R53.81 ADL and mobility dysfunction\n2. M62.81 Neuromuscular weakness and de-conditioning\n3. R26.81 Gait Instability\n4. S73.001D Unspecified subluxation of right hip, subsequent encounter5. S79.911D Unspecified injury of right hip, subsequent encounter",
        "Plan": "1. Medical necessity for rehabilitation: Continues to have declined in function/weakness, difficulty walking. Continue working on ankle pumps, transfers and quad sets.\n2. Current level of function: No rehab updates\n3. Care team coordination: Discussed with therapy team; continue therapy per orders\n4. Follow-up: Physiatry will follow-up and reassess patient in 2-5 days and/or more frequently as needed as deemed per primary team/rehabilitation team/nursing.  Goal of follow-up visits will be to reassess any decline in function, review therapy evaluations and notes, diagnose any current/new/or potential barriers to rehabilitation, and maintain appropriateness of patient’s progression in therapies. Barriers to rehabilitation may prevent a safe and timely discharge of patient; and goal of Physiatry oversight is to maintain safe and timely discharge of patient’s overall admission in nursing facility setting to discharge setting.  During follow-up visits, Physiatry will re-order certifications for continued therapies."
      },
      {
        "ID": 3,
        "Patient Name": "Chittema, Theresa M.",
        "Date of Birth": "6/24/1948",
        "Date of Service": "11/18/2019",
        "Facility": "Chamberlain Healthcare Manor",
        "Chief Complaint": "Neuromuscular weakness and ADL dysfunction secondary to chronic obstructive pulmonary disease with (acute) exacerbation and acute and chronic respiratory failure with hypoxia.",
        "HPI": "The patient was seen and examined today. \n\nThe patient states that physical therapy seems to be going well.",
        "Interval History": "The patient is tolerating therapies but continues to have declined in function/weakness, respiratory decline. Continues to work with therapy team to regain to prior level of function and independence for safe discharge.  PM&R to continue to monitor progress and evaluate for further rehabilitation needs and recommendations.",
        "Review Of Systems": "(Gained from chart review, interview of patient and (or) family and discussion with staff): As per HPI above. Otherwise, 12 systems were reviewed and were negative.",
        "Past Medical History": "COPD exacerbation, acute respiratory failure, HTN, hypothyroidism, pre-DM, hypoxemia, and dyspnea",
        "Medications": "As per MAR (reviewed pertinent medications today)",
        "Physical Examination": "Vital Signs: VSS-R\nGeneral Appearance: NAD, well-groomed\nHEENT: Normocephalic, EOMI, supple neck, post pharynx normal\nRespiratory: Unlabored, no cough \nCardiovascular: RRR, S1/S2\nPsychological: Alert, and cooperative\nGI: +bowel sounds, S/NT/ND\nComprehensive MSK (Skeletal): The patient is wearing oxygen. He is barrel-chested. He is kyphotic. He has clubbing of the fingernails. Has muscle atrophy of U/LE. Sensation is intact. Has decreased proprioception in the LE. 3/5 strength of LE and 3/5 strength of UE. Has abnormal gait during ambulation.\nNeurological: CN 7 and CN 11 checked and intact.\nReflexes: 2+ and symmetrical in bilateral upper and lower extremities\nSkin: No heel ulcers\nExt: No edema, no calf tenderness, pedal pulses present",
        "Assessment": "1. R53.81 ADL and mobility dysfunction\n2. M62.81 Neuromuscular weakness and de-conditioning\n3. R26.81 Gait Instability\n4. J44.1 Chronic obstructive pulmonary disease with (acute) exacerbation\n5. J96.21 Acute and chronic respiratory failure with hypoxia",
        "Plan": "1. Medical necessity for rehabilitation: Continues to have declined in function/weakness, respiratory decline. Continue working on endurance activities, gait pattern and seated therapy exercises.\n2. Current level of function: BLE ther ex seated without weight 2 x 10 to improve strength and activity tolerance for functional mobility; Cl(S) transfers , req (A) with O2 tubing mgmt\n3. Care team coordination: Discussed with therapy team; continue therapy per orders\n4. Follow-up: Physiatry will follow-up and reassess patient in 2-5 days and/or more frequently as needed as deemed per primary team/rehabilitation team/nursing.  Goal of follow-up visits will be to reassess any decline in function, review therapy evaluations and notes, diagnose any current/new/or potential barriers to rehabilitation, and maintain appropriateness of patient’s progression in therapies. Barriers to rehabilitation may prevent a safe and timely discharge of patient; and goal of Physiatry oversight is to maintain safe and timely discharge of patient’s overall admission in nursing facility setting to discharge setting.  During follow-up visits, Physiatry will re-order certifications for continued therapies."
      }
    ];

    $(document).ready(function() {
      $('#bs-example').DataTable({
        "data": patient_list,
        "columns": [
          { "data": "ID" },
          { "data": "Patient Name" },
          { "data": "Date of Birth" },
          { "data": "Date of Service" },
          { "data": "Facility" },
          // ,{ "data": "Chief Complaint" },
          // { "data": "HPI" },
          // { "data": "Interval History" },
          // { "data": "Review Of Systems" },
          // { "data": "Past Medical History" },
          // { "data": "Medications" },
          // { "data": "Physical Examination" },
          // { "data": "Assessment" },
          // { "data": "Plan" },
          {
            "data": function(ID: any) {
              // return "<a href=Test</a>";
              return "<button type=\"button\" class=\"btn btn-primary btn-sm dt-edit\" style=\"margin-right:16px; fontSize=\"11px\";\"> <span class=\"fas fa-edit\" aria-hidden=\"true\"></span>";
            }
          }
        ]
      });

      $('.dt-edit').each(function() {
        $(this).on('click', function(evt) {
          // $('.dt-edit').each(() => {
          //   $(this).on('click', (evt) => {
          //var msg: string = '';
          //$(this).parent().parent().children()[1].innerText //<td>Airi Satou</td>
          //$(this).parents('tr').children()[1].innerText
          //$(this).parents('tr')[0].cells[1].innerText

          var dtRow = $(this).parents('tr');


          //alert('You clicked on ' + dtRow.children()[1].innerText);
          var field0 = dtRow.children()[0].innerText;
          var field1 = dtRow.children()[1].innerText;
          var field2 = dtRow.children()[2].innerText;
          var field3 = dtRow.children()[3].innerText;
          var field4 = dtRow.children()[4].innerText;
          // var field5 = dtRow.children()[5].innerText;
          // var field6 = dtRow.children()[6].innerText;
          document.getElementById('name-plate').innerHTML = field1;

          // var pd = this.loadPatientDetails(Number(field0));
          // alert(pd.toString());
          var field5: string = '';
          var field6: string = '';
          var field7: string = '';
          var field8: string = '';
          var field9: string = '';
          var field10: string = '';
          var field11: string = '';
          var field12: string = '';
          var field13: string = '';

          for (var i = 0; i < patient_list.length; i++) {
            if (patient_list[i].ID == Number(field0)) {
              field5 = patient_list[i]["Chief Complaint"];
              field6 = patient_list[i]["HPI"];
              field7 = patient_list[i]["Interval History"];
              field8 = patient_list[i]["Review Of Systems"];
              field9 = patient_list[i]["Past Medical History"];
              field10 = patient_list[i]["Medications"];
              field11 = patient_list[i]["Physical Examination"];
              field12 = patient_list[i]["Assessment"];
              field13 = patient_list[i]["Plan"];
            }

          };


          var pDetailsFbody: any = $("#pDetailsF");
          //mdlbody.html('<p>Test</p>');
          var bdy: string = `
          <div>
          <form class=\"border-info\">
          <div class=\"form-group\">

          <div class=\"row pt-2\">
            <label for=\"patient-id\" class=\"col-md-3\">ID:</label>
            <input type=\"text\" class=\"form-control col-md-7\" id=\"patient-id\" value="` + field0 + `"></input>
          </div>

          <div class=\"row pt-2\">
            <label for=\"patient-name\" class=\"col-md-3\">Name:</label>
            <input class=\"form-control col-md-7\" id=\"patient-name\" value="` + field1 + `"></input>
          </div>

          <div class=\"row pt-2\">
            <label for=\"patient-DOB\" class=\"col-md-3\">Date Of Birth:</label>
            <input class=\"form-control col-md-7\" id=\"patient-DOB\" value="` + field2 + `"></input>
          </div>

          <div class=\"row pt-2\">
            <label for=\"patient-DOS\" class=\"col-md-3\">Date of Service:</label>
            <input class=\"form-control col-md-7\" id=\"patient-DOS\" value="` + field3 + `"></input>
          </div>

          <div class=\"row pt-2\">
            <label for=\"patient-facility\" class=\"col-md-3\">Facility:</label>
            <input class=\"form-control col-md-7\" id=\"patient-facility\" value="` + field4 + `"></input>
          </div>

          <div class=\"row pt-2\">
            <label for=\"patient-comp\" class=\"col-md-3\">Chief Complaint:</label>
            <textarea rows=\"7\" class=\"form-control col-md-7\" id=\"patient-comp\">` + field5 + `</textarea>
          </div>

          <div class=\"row pt-2\">
            <label for=\"patient-HPI\" class=\"col-md-3\">HPI:</label>
            <textarea rows=\"7\" class=\"form-control col-md-7\" id=\"patient-HPI\">` + field6 + `</textarea>
          </div>

          <div class=\"row pt-2\">
            <label for=\"patient-IH\" class=\"col-md-3\">Interval History:</label>
            <textarea rows=\"7\" class=\"form-control col-md-7\" id=\"patient-IH\">` + field7 + `</textarea>
          </div>

          <div class=\"row pt-2\">
            <label for=\"patient-RS\" class=\"col-md-3\">Review Of Systems:</label>
            <textarea rows=\"7\" class=\"form-control col-md-7\" id=\"patient-RS\">` + field8 + `</textarea>
          </div>

          <div class=\"row pt-2\">
            <label for=\"patient-PMH\" class=\"col-md-3\">Past Medical History:</label>
            <textarea rows=\"7\" class=\"form-control col-md-7\" id=\"patient-PMH\">` + field9 + `</textarea>
          </div>

          <div class=\"row pt-2\">
            <label for=\"patient-Med\" class=\"col-md-3\">Medications:</label>
            <textarea rows=\"7\" class=\"form-control col-md-7\" id=\"patient-Med\">` + field10 + `</textarea>
          </div>

          <div class=\"row pt-2\">
            <label for=\"patient-PE\" class=\"col-md-3\">Physical Examination:</label>
            <textarea rows=\"7\" class=\"form-control col-md-7\" id=\"patient-PE\">` + field11 + `</textarea>
          </div>

          <div class=\"row pt-2\">
            <label for=\"patient-assmt\" class=\"col-md-3\">Assessment:</label>
            <textarea rows=\"7\" class=\"form-control col-md-7\" id=\"patient-assmt\">` + field12 + `</textarea>
          </div>

          <div class=\"row pt-2\">
            <label for=\"patient-paln\" class=\"col-md-3\">Plan:</label>
            <textarea rows=\"7\" class=\"form-control col-md-7\" id=\"patient-plan\">` + field13 + `</textarea>
          </div>

          </div>

          </form>
          <div class="row justify-content-center">
            <button type=\"button\" class=\"btn btn-primary\">Save</button>
          </div>
          </div>
          `;

          // var bdy: string = `
          // <form>
          // <div class=\"form-group\">
          //   <label for=\"patient-id\" class=\"col-form-label\">ID:</label>
          //   <input type=\"text\" class=\"form-control\" id=\"patient-id\" value="` + field0 + `"></input>
          // </div>
          // <div class=\"form-group\">
          //   <label for=\"patient-name\" class=\"col-form-label\">Name:</label>
          //   <input class=\"form-control\" id=\"patient-name\" value="` + field1 + `"></input>
          // </div>
          // </form>
          // `;


          pDetailsFbody.html(bdy);
          var pdTab: any = $("#patientTabList li:eq(1) a");
          pdTab.tab('show');

          //$("#patientTabList li:eq(1) a").tab('show');

          //tabsList.tabs("option","active", $("#pDetails").index());
          //tabsList.tab('show');
          //tabsList.addClass('active');
          //tab.next().addClass('active');

          // var tab = $(this).closest('.tab-pane');
          // $('#' + tab[0].id + ', .nav-pills li').removeClass('active');
          // $('.nav-pills li a[href="#' + tab.next()[0].id + '"]').parent().addClass('active');
          // tab.next().addClass('active');



        });
      });
      // $(function(){
      //     $('#myForm').on('submit', function(e){
      //       e.preventDefault();
      //       $.post('http://www.somewhere.com/path/to/post',
      //          $('#myForm').serialize(),
      //          function(data, status, xhr){
      //            // do something here with response;
      //          });
      //     });
      // });
    });
  }

  loadPatientDetails(id: number): object {
    var patient_Details = [
      {
        "ID": 1,
        "Patient Name": "Koetscha, Bernard",
        "Date of Birth": "8/14/1947",
        "Date of Service": "11/18/2019",
        "Facility": "Chamberlain Healthcare Manor",
        "Chief Complaint": "Neuromuscular weakness and ADL dysfunction secondary to the presence of left artificial hip joint.",
        "HPI": "The patient was seen and examined today. \n\nThe patient states that physical therapy seems to be going pretty good.",
        "Interval History": "The patient is tolerating therapies but continues to have declined in function/weakness. Continues to work with therapy team to regain to prior level of function and independence for safe discharge.  PM&R to continue to monitor progress and evaluate for further rehabilitation needs and recommendations.",
        "Review Of Systems": "(Gained from chart review, interview of patient and (or) family and discussion with staff): As per HPI above. Otherwise, 12 systems were reviewed and were negative",
        "Past Medical History": "BPH, bipolar, hypercholesteremia, benign essential tremor, CVA, PVD, depression, Afib, CAD, MI s/p stents, arthritis, s/p R THR.",
        "Medications": "As per MAR (reviewed pertinent medications today)",
        "Physical Examination": "Vital Signs: VSS-R\nGeneral Appearance: NAD, well-groomed\nHEENT: Normocephalic, EOMI, supple neck, post pharynx normal\nRespiratory: Unlabored, no cough \nCardiovascular: RRR, S1/S2\nPsychological: Alert, and cooperative\nGI: +bowel sounds, S/NT/ND\nComprehensive MSK (Skeletal): The patient has decreased ROM in the LLE at the hip secondary to joint replacement, both passive and active. Right is intact in full ROM. Muscle tone and sensation are intact. No LE edema. Proprioception is intact. Has abnormal gait during ambulation. Has 3/5 strength of LE and 4/5 strength of UE.\nNeurological: CN 7 and CN 11 checked and intact.\nReflexes: 2+ and symmetrical in bilateral upper and lower extremities\nSkin: No heel ulcers\nExt: No edema, no calf tenderness, pedal pulses present",
        "Assessment": "1. R53.81 ADL and mobility dysfunction\n2. M62.81 Neuromuscular weakness and de-conditioning\n3. R26.81 Gait Instability\n4. Z96.642 Presence of left artificial hip joint\n1. R53.81 ADL and mobility dysfunction\n2. M62.81 Neuromuscular weakness and de-conditioning\n3. R26.81 Gait Instability\n4. Z96.642 Presence of left artificial hip joint\n1. R53.81 ADL and mobility dysfunction\n2. M62.81 Neuromuscular weakness and de-conditioning\n3. R26.81 Gait Instability\n4. Z96.642 Presence of left artificial hip joint",
        "Plan": "1. Medical necessity for rehabilitation: Continues to have declined in function/weakness. Continue working on quad sets, ankle pumps and transfers.\n2. Current level of function: Amb 15'x2, 40', 60' with CGA and RW; sit/stand with vc's for hand placements from elevated surfaces; \n3. Care team coordination: Discussed with therapy team; continue therapy per orders\n4. Follow-up: Physiatry will follow-up and reassess patient in 2-5 days and/or more frequently as needed as deemed per primary team/rehabilitation team/nursing.  Goal of follow-up visits will be to reassess any decline in function, review therapy evaluations and notes, diagnose any current/new/or potential barriers to rehabilitation, and maintain appropriateness of patient’s progression in therapies. Barriers to rehabilitation may prevent a safe and timely discharge of patient; and goal of Physiatry oversight is to maintain safe and timely discharge of patient’s overall admission in nursing facility setting to discharge setting.  During follow-up visits, Physiatry will re-order certifications for continued therapies."
      },
      {
        "ID": 2,
        "Patient Name": "Sherbacka, Joyce",
        "Date of Birth": "10/26/1943",
        "Date of Service": "11/18/2019",
        "Facility": "Chamberlain Healthcare Manor",
        "Chief Complaint": "Neuromuscular weakness and ADL dysfunction secondary to unspecified subluxation of right hip, subsequent encounter, unspecified injury of right hip, subsequent encounter",
        "HPI": "The patient was seen and examined today. \n\nThe patient states that physical therapy seems to be going well.",
        "Interval History": "The patient is tolerating therapies but continues to have declined in function/weakness, difficulty walking. Continues to work with therapy team to regain to prior level of function and independence for safe discharge.  PM&R to continue to monitor progress and evaluate for further rehabilitation needs and recommendations.",
        "Review Of Systems": "(Gained from chart review, interview of patient and (or) family and discussion with staff): As per HPI above. Otherwise, 12 systems were reviewed and were negative.",
        "Past Medical History": "Cystocele, glaucoma, HTN, hx chemotherapy, active smoker, \" mild mental retardation\", left breast Ca, hydronephrosis, closed nondisplaced fx of shaft of left clavicle, wrist fx, cataract extraction w/intraocular lens implant, simple mastectomy, sentinel lymph node biopsy, eye surgery, US-guided breast biopsy, lymph node dissection/axillary node dissection.",
        "Medications": "As per MAR (reviewed pertinent medications today)",
        "Physical Examination": "Vital Signs: VSS-R\nGeneral Appearance: NAD, well-groomed\nHEENT: Normocephalic, EOMI, supple neck, post pharynx normal\nRespiratory: Unlabored, no cough\nCardiovascular: RRR, S1/S2\nPsychological: Alert, and cooperative\nGI: +bowel sounds, S/NT/ND\nComprehensive MSK (Skeletal): The patient has decreased ROM of the right hip secondary to dislocation. Flexion and extension, adduction and abduction. Has abnormal gait during ambulation. Has 3/5 strength of LE and 3/5 strength of UE. No LE edema.\nNeurological: CN 7 and CN 11 checked and intact.\nReflexes: 2+ and symmetrical in bilateral upper and lower extremities\nSkin: No heel ulcers\nExt: No edema, no calf tenderness, pedal pulses present",
        "Assessment": "1. R53.81 ADL and mobility dysfunction\n2. M62.81 Neuromuscular weakness and de-conditioning\n3. R26.81 Gait Instability\n4. S73.001D Unspecified subluxation of right hip, subsequent encounter5. S79.911D Unspecified injury of right hip, subsequent encounter",
        "Plan": "1. Medical necessity for rehabilitation: Continues to have declined in function/weakness, difficulty walking. Continue working on ankle pumps, transfers and quad sets.\n2. Current level of function: No rehab updates\n3. Care team coordination: Discussed with therapy team; continue therapy per orders\n4. Follow-up: Physiatry will follow-up and reassess patient in 2-5 days and/or more frequently as needed as deemed per primary team/rehabilitation team/nursing.  Goal of follow-up visits will be to reassess any decline in function, review therapy evaluations and notes, diagnose any current/new/or potential barriers to rehabilitation, and maintain appropriateness of patient’s progression in therapies. Barriers to rehabilitation may prevent a safe and timely discharge of patient; and goal of Physiatry oversight is to maintain safe and timely discharge of patient’s overall admission in nursing facility setting to discharge setting.  During follow-up visits, Physiatry will re-order certifications for continued therapies."
      },
      {
        "ID": 3,
        "Patient Name": "Chittema, Theresa M.",
        "Date of Birth": "6/24/1948",
        "Date of Service": "11/18/2019",
        "Facility": "Chamberlain Healthcare Manor",
        "Chief Complaint": "Neuromuscular weakness and ADL dysfunction secondary to chronic obstructive pulmonary disease with (acute) exacerbation and acute and chronic respiratory failure with hypoxia.",
        "HPI": "The patient was seen and examined today. \n\nThe patient states that physical therapy seems to be going well.",
        "Interval History": "The patient is tolerating therapies but continues to have declined in function/weakness, respiratory decline. Continues to work with therapy team to regain to prior level of function and independence for safe discharge.  PM&R to continue to monitor progress and evaluate for further rehabilitation needs and recommendations.",
        "Review Of Systems": "(Gained from chart review, interview of patient and (or) family and discussion with staff): As per HPI above. Otherwise, 12 systems were reviewed and were negative.",
        "Past Medical History": "COPD exacerbation, acute respiratory failure, HTN, hypothyroidism, pre-DM, hypoxemia, and dyspnea",
        "Medications": "As per MAR (reviewed pertinent medications today)",
        "Physical Examination": "Vital Signs: VSS-R\nGeneral Appearance: NAD, well-groomed\nHEENT: Normocephalic, EOMI, supple neck, post pharynx normal\nRespiratory: Unlabored, no cough \nCardiovascular: RRR, S1/S2\nPsychological: Alert, and cooperative\nGI: +bowel sounds, S/NT/ND\nComprehensive MSK (Skeletal): The patient is wearing oxygen. He is barrel-chested. He is kyphotic. He has clubbing of the fingernails. Has muscle atrophy of U/LE. Sensation is intact. Has decreased proprioception in the LE. 3/5 strength of LE and 3/5 strength of UE. Has abnormal gait during ambulation.\nNeurological: CN 7 and CN 11 checked and intact.\nReflexes: 2+ and symmetrical in bilateral upper and lower extremities\nSkin: No heel ulcers\nExt: No edema, no calf tenderness, pedal pulses present",
        "Assessment": "1. R53.81 ADL and mobility dysfunction\n2. M62.81 Neuromuscular weakness and de-conditioning\n3. R26.81 Gait Instability\n4. J44.1 Chronic obstructive pulmonary disease with (acute) exacerbation\n5. J96.21 Acute and chronic respiratory failure with hypoxia",
        "Plan": "1. Medical necessity for rehabilitation: Continues to have declined in function/weakness, respiratory decline. Continue working on endurance activities, gait pattern and seated therapy exercises.\n2. Current level of function: BLE ther ex seated without weight 2 x 10 to improve strength and activity tolerance for functional mobility; Cl(S) transfers , req (A) with O2 tubing mgmt\n3. Care team coordination: Discussed with therapy team; continue therapy per orders\n4. Follow-up: Physiatry will follow-up and reassess patient in 2-5 days and/or more frequently as needed as deemed per primary team/rehabilitation team/nursing.  Goal of follow-up visits will be to reassess any decline in function, review therapy evaluations and notes, diagnose any current/new/or potential barriers to rehabilitation, and maintain appropriateness of patient’s progression in therapies. Barriers to rehabilitation may prevent a safe and timely discharge of patient; and goal of Physiatry oversight is to maintain safe and timely discharge of patient’s overall admission in nursing facility setting to discharge setting.  During follow-up visits, Physiatry will re-order certifications for continued therapies."
      }
    ];

    //var col = [];
    for (var i = 0; i < patient_Details.length; i++) {
      if (patient_Details[i].ID == id)
        return patient_Details[i];
    };

  }

  //async joinMeeting(): Promise<any> {
  async getAllPatients(): Promise<any> {
    const response = await fetch(
      `${eTreatApp.BASE_URL}getAllPatients`);
    const json = await response.json();

    console.log("response= " + JSON.stringify(json));
    if (json.error) {
      throw new Error(`Server error: ${json.error}`);
    }
    return json;
  }

  popUpModal(): void {
  }

}

window.addEventListener('load', () => {
  new eTreatApp();
});
