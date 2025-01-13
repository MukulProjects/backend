import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody, ConnectedSocket } from '@nestjs/websockets';
import { Injectable } from '@nestjs/common';
import { Socket, Server } from 'socket.io';
import { ChatService } from './chat.service';

interface SessionClient {
    socket: Socket;
    role: string;
}

@WebSocketGateway({
    cors: {
      origin: [
        'http://localhost:3001',  // Local development server
        'http://localhost:3002',  // Local server for other clients if any
        'https://www.kaeeraventures.shop',  // Production server
        'https://backjust.vercel.app',  // Vercel deployment
      ],
      methods: ['GET', 'POST'],
      credentials: true, // Ensure credentials are sent
    },
    transports: ['websocket', 'polling'], // Support both websocket and polling
  })
@Injectable()
export class ChatGateway {
    @WebSocketServer()
    server: Server;

    private activeSessions: Map<string, SessionClient[]> = new Map();
    private sessionAIStatus: Map<string, boolean> = new Map();
    
    constructor(private readonly chatService: ChatService) {}

    @SubscribeMessage('sendMessage')
    async handleMessage(
        @MessageBody() message: { sessionId: string; userMessage: string; sender: string },
        @ConnectedSocket() socket: Socket
    ) {
        const { sessionId, userMessage, sender } = message;
        const senderType = sender === 'admin' ? 'Admin' : 'User';

        if (sender === 'admin') {
            await this.chatService.saveChat(userMessage, '', 'general', sessionId, senderType);
            this.broadcastMessage(sessionId, sender, userMessage, '');
            return;
        }

        let aiResponse = '';
        if (!this.sessionAIStatus.get(sessionId)) {
            aiResponse = await this.chatService.getAIResponse(userMessage, 'general', sessionId);
            this.sessionAIStatus.set(sessionId, true);
        }

        await this.chatService.saveChat(userMessage, aiResponse, 'general', sessionId, senderType);
        this.broadcastMessage(sessionId, sender, userMessage, aiResponse);
    }

    private broadcastMessage(sessionId: string, sender: string, userMessage: string, aiResponse: string) {
        const clients = this.getSocketsForSession(sessionId);
        if (clients) {
            clients.forEach(clientSocket => {
                clientSocket.emit('receiveMessage', {
                    sessionId,
                    sender,
                    userMessage,
                    aiResponse: sender === 'admin' ? null : aiResponse,
                });
            });
        }
    }

    @SubscribeMessage('typing')
    handleTyping(@MessageBody() { sessionId, sender }: { sessionId: string; sender: string }) {
        const clients = this.getSocketsForSession(sessionId);
        if (clients) {
            clients.forEach(clientSocket => {
                clientSocket.emit('typing', { sessionId, sender });
            });
        }
    }

    handleConnection(socket: Socket) {
        const { sessionId, role } = socket.handshake.query;
    
        if (!sessionId || !role) {
            console.log("Missing sessionId or role");
            socket.disconnect();
            return;
        }
    
        const sessionIdToUse = Array.isArray(sessionId) ? sessionId[0] : sessionId;
        this.addClientToSession(sessionIdToUse, socket, role as string);
    }

    handleDisconnect(socket: Socket) {
        this.activeSessions.forEach((clients, sessionId) => {
            const updatedClients = clients.filter(client => client.socket.id !== socket.id);
            if (updatedClients.length > 0) {
                this.activeSessions.set(sessionId, updatedClients);
            } else {
                this.activeSessions.delete(sessionId);
            }
        });
    }

    private addClientToSession(sessionId: string, socket: Socket, role: string) {
        if (!this.activeSessions.has(sessionId)) {
            this.activeSessions.set(sessionId, []);
        }
        this.activeSessions.get(sessionId)?.push({ socket, role });
    }

    private getSocketsForSession(sessionId: string): Socket[] | undefined {
        return this.activeSessions.get(sessionId)?.map(client => client.socket);
    }
}
