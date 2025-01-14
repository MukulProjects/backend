import { Controller, Post, Body, Get, Query, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';

@Controller('chat')
export class ChatController {
    constructor(private readonly chatService: ChatService,
        private readonly chatGateway: ChatGateway,
    ) { }

    @Post()
    async sendMessage(@Body() body: { userMessage: string; profession?: string; sessionId?: string; sender: string }) {
        const { userMessage, profession, sessionId, sender } = body;
        if (!userMessage || !sender) {
            throw new BadRequestException('Missing required fields: userMessage and sender');
        }
        const sessionIdToUse = sessionId || this.chatService.generateSessionId();
        try {
            const aiResponse = await this.chatService.getAIResponse(userMessage, profession ?? 'general', sessionIdToUse);
            await this.chatService.saveChat(userMessage, aiResponse, profession ?? 'general', sessionIdToUse, sender);

            // Emit message to the client through the WebSocket server
            this.chatGateway.server.emit('receiveMessage', {
                sessionId: sessionIdToUse,
                sender,
                userMessage,
                aiResponse,
            });

            return { aiResponse, sessionId: sessionIdToUse };
        } catch (error) {
            throw new InternalServerErrorException('Failed to process message');
        }
    }

    @Get('messages')
    async getChatMessages(@Query('sessionId') sessionId: string) {
        if (!sessionId) {
            throw new BadRequestException('sessionId is required');
        }
        const messages = await this.chatService.getChatMessages(sessionId);
        return { sessionId, messages };
    }

    @Get('greeting')
    async getGreeting(@Query('profession') profession: string) {
        if (!profession) {
            return { error: 'Profession is required' };
        }
        const greetingMessage = this.chatService.getGreetingMessage(profession);
        return { profession, greetingMessage };
    }

    @Get()
    async getMessages(@Query('sessionId') sessionId: string) {
        return this.chatService.getChatMessages(sessionId);
    }

    @Get('/allChats')
    async getAllChats() {
        return this.chatService.getAllChats();
    }
}
