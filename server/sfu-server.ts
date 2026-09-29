import expremediasoup from "mediasoup";
import { Server as SocketIOServer } from "socket.io";
import os from "os";

/**
 * mediasoup SFU Server
 * 
 * This module manages mediasoup workers, routers, transports, producers, and consumers
 * for scalable WebRTC video/audio conferencing using SFU (Selective Forwarding Unit) topology.
 * 
 * Architecture:
 * - Workers: 1 per CPU core (max 4) for load distribution
 * - Routers: 1 per voice/video channel
 * - Transports: 2 per participant (send + receive)
 * - Producers: 1-2 per participant (audio + optional vide