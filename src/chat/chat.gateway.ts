import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    MessageBody,
    ConnectedSocket,
} from '@nestjs/websockets';
import { Injectable } from '@nestjs/common';
import { Socket, Server } from 'socket.io';
import { ChatService } from './chat.service';

interface SessionClient {
    socket: Socket;
    role: string;
    sessionId: string;
}

@WebSocketGateway({
    cors: {
        origin: ['http://localhost:3001', 'http://localhost:3002','https://www.kaeeraventures.shop','https://adminchat.vercel.app/'],
        methods: ['GET', 'POST'],
        credentials: true,
    },
    transports: ['websocket', 'polling'],
})
@Injectable()
export class ChatGateway {
    @WebSocketServer()
    server: Server;

    private activeSessions: Map<string, SessionClient[]> = new Map();

    constructor(private readonly chatService: ChatService) {}

    // Handles receiving a message and broadcasting it
    @SubscribeMessage('sendMessage')
    async handleMessage(
        @MessageBody() data: { sessionId: string, userMessage: string, sender: string },
        @ConnectedSocket() socket: Socket
    ) {
        const { sessionId, userMessage, sender } = data;
        
        // Get AI response based on profession
        const aiResponse = await this.chatService.getAIResponse(userMessage, 'anyother', sessionId);

        // Save the chat and send both user and AI messages to admin
        await this.chatService.saveChat(userMessage, aiResponse, 'anyother', sessionId, sender);
        
        // Emit message to all clients (admin and users)
        this.broadcastMessage(sessionId, sender, userMessage, aiResponse);
    }

    // Broadcast messages to both admin and user in the session
    private broadcastMessage(sessionId: string, sender: string, userMessage: string, aiResponse: string) {
        const clients = this.getSocketsForSession(sessionId);
        if (clients) {
            clients.forEach((clientSocket) => {
                clientSocket.emit('receiveMessage', {
                    sessionId,
                    sender, // Ensure sender is either 'admin' or 'user'
                    userMessage,
                    aiResponse: sender === 'user' ? aiResponse : null,
                });
            });
        }
    }

    // Handles user typing
    @SubscribeMessage('typing')
    handleTyping(@MessageBody() { sessionId, sender }: { sessionId: string; sender: string }) {
        const clients = this.getSocketsForSession(sessionId);
        if (clients) {
            clients.forEach(clientSocket => {
                clientSocket.emit('typing', { sessionId, sender });
            });
        }
    }

    // When a socket connects, associate it with a session ID
    handleConnection(socket: Socket) {
        const { sessionId, role } = socket.handshake.query;

        if (!sessionId || !role) {
            console.error('Missing sessionId or role during connection.');
            socket.disconnect();
            return;
        }

        const sessionIdToUse = Array.isArray(sessionId) ? sessionId[0] : sessionId;
        console.log(`Client connected with sessionId: ${sessionIdToUse}, role: ${role}`);
        this.addClientToSession(sessionIdToUse, socket, role as string);
    }

    // Handle disconnect
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

    // Add client to a session
    private addClientToSession(sessionId: string, socket: Socket, role: string) {
        if (!this.activeSessions.has(sessionId)) {
            this.activeSessions.set(sessionId, []);
        }
        this.activeSessions.get(sessionId)?.push({ socket, role, sessionId });
    }

    // Get all sockets for a given session
    private getSocketsForSession(sessionId: string): Socket[] | undefined {
        return this.activeSessions.get(sessionId)?.map(client => client.socket);
    }
}
