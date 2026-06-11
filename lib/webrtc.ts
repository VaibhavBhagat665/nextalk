/**
 * WebRTC Peer Connection Manager
 * Handles STUN/TURN, ICE candidates, and Media Streams.
 */

const STUN_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

export class WebRTCManager {
  public peerConnection: RTCPeerConnection | null = null;
  public localStream: MediaStream | null = null;
  public remoteStream: MediaStream | null = null;

  private onIceCandidateCallback: ((candidate: RTCIceCandidate) => void) | null = null;
  private onTrackCallback: ((track: MediaStreamTrack, streams: readonly MediaStream[]) => void) | null = null;
  private onConnectionStateChangeCallback: ((state: RTCPeerConnectionState) => void) | null = null;

  constructor() {
    this.remoteStream = new MediaStream();
  }

  // 1. Initialize the Peer Connection
  public initConnection() {
    const iceServers: RTCIceServer[] = [...STUN_SERVERS];
    
    // Optional TURN server config from env (needed for NAT traversal in prod)
    if (process.env.NEXT_PUBLIC_TURN_URL) {
      iceServers.push({
        urls: process.env.NEXT_PUBLIC_TURN_URL,
        username: process.env.NEXT_PUBLIC_TURN_USERNAME || "",
        credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL || "",
      });
    }

    this.peerConnection = new RTCPeerConnection({ iceServers });

    // Handle ICE Candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.onIceCandidateCallback) {
        this.onIceCandidateCallback(event.candidate);
      }
    };

    // Handle incoming media tracks
    this.peerConnection.ontrack = (event) => {
      if (this.remoteStream) {
        this.remoteStream.addTrack(event.track);
      }
      if (this.onTrackCallback) {
        this.onTrackCallback(event.track, event.streams);
      }
    };

    // Handle connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      if (this.peerConnection && this.onConnectionStateChangeCallback) {
        this.onConnectionStateChangeCallback(this.peerConnection.connectionState);
      }
    };
  }

  // 2. Start local media (Camera/Mic)
  public async startLocalStream(video: boolean = false): Promise<MediaStream> {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: video ? { facingMode: "user" } : false,
      });

      // Add tracks to peer connection
      if (this.peerConnection) {
        this.localStream.getTracks().forEach((track) => {
          this.peerConnection?.addTrack(track, this.localStream!);
        });
      }

      return this.localStream;
    } catch (error) {
      console.error("Error accessing media devices.", error);
      throw error;
    }
  }

  // 3. Create Offer (Caller)
  public async createOffer(): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) throw new Error("PeerConnection not initialized");
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    return offer;
  }

  // 4. Create Answer (Callee)
  public async createAnswer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) throw new Error("PeerConnection not initialized");
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    return answer;
  }

  // 5. Handle incoming answer (Caller)
  public async handleAnswer(answer: RTCSessionDescriptionInit) {
    if (!this.peerConnection) throw new Error("PeerConnection not initialized");
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
  }

  // 6. Add ICE Candidate
  public async addIceCandidate(candidate: RTCIceCandidateInit) {
    if (!this.peerConnection) throw new Error("PeerConnection not initialized");
    await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  }

  // 7. Toggle Audio/Video
  public toggleAudio(enabled: boolean) {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => (track.enabled = enabled));
    }
  }

  public toggleVideo(enabled: boolean) {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach(track => (track.enabled = enabled));
    }
  }

  // 8. Cleanup
  public close() {
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    this.remoteStream = new MediaStream(); // reset
  }

  // Callbacks
  public onIceCandidate(callback: (candidate: RTCIceCandidate) => void) {
    this.onIceCandidateCallback = callback;
  }

  public onTrack(callback: (track: MediaStreamTrack, streams: readonly MediaStream[]) => void) {
    this.onTrackCallback = callback;
  }

  public onConnectionStateChange(callback: (state: RTCPeerConnectionState) => void) {
    this.onConnectionStateChangeCallback = callback;
  }
}
