import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Chat } from './chat.schema';
import * as uuid from 'uuid'; // For generating unique session IDs

@Injectable()
export class ChatService {
    private responses = {
        plumber: {
            greeting: "Hello! How can I help you with plumbing?",
            leakyPipe: "Can you please elaborate more on the leaky pipes issue?",
            commonQuery: "Please provide more details about the plumbing issue, and I will try to assist you.",
        },
        doctor: {
            greeting: "Hello! How can I help you with your medical queries?",
            prescriptionQuery: "Please visit a doctor in person for a prescription, as they need to evaluate your condition first.",
            emergencyQuery: "If it's an emergency, please call emergency services immediately.",
            commonQuery: "Can you describe your symptoms in more detail so I can assist you better?",
        },
        lawyer: {
            greeting: "Hello! How can I assist you with your legal concerns?",
            contractQuery: "Could you share more details about the contract issue you're facing?",
            commonQuery: "Please describe your legal issue, and I will provide general guidance.",
        },
        vet: {
            greeting: "Hello! How can I help with your pet's health concerns?",
            emergencyQuery: "If your pet is in distress, please contact an emergency vet immediately.",
            commonQuery: "Please provide more details about your pet's symptoms or behavior.",
        },
        electrician: {
            greeting: "Hello! How can I assist you with your electrical needs?",
            wiringIssue: "Can you provide more details about the wiring issue?",
            commonQuery: "Please describe the electrical problem so I can guide you better.",
        },
        electronics: {
            greeting: "Hello! How can I help you with your electronic device?",
            deviceRepair: "Could you provide more details about the issue with your device?",
            commonQuery: "Please elaborate on the problem with your electronics for better assistance.",
        },
        computer: {
            greeting: "Hello! How can I assist you with your computer issue?",
            softwareIssue: "Can you provide more information about the software issue?",
            hardwareIssue: "Could you describe the hardware problem in detail?",
            commonQuery: "Please specify the issue with your computer for tailored assistance.",
        },
        mechanic: {
            greeting: "Hello! How can I help you with your vehicle?",
            engineProblem: "Could you provide more details about the engine issue?",
            commonQuery: "Please describe the vehicle problem for better guidance.",
        },
        tax: {
            greeting: "Hello! How can I assist you with your tax-related queries?",
            filingAssistance: "Could you provide more details about the tax filing issue?",
            commonQuery: "Please describe your tax concern so I can offer relevant assistance.",
        },
        accountant: {
            greeting: "Hello! How can I help you with your accounting needs?",
            bookkeepingQuery: "Could you provide more details about the bookkeeping issue?",
            commonQuery: "Please describe the accounting matter so I can assist you better.",
        },
        anyother: {
            greeting: "Hello! How can I help you today?",
            commonQuery: "Please provide more details about your concern so I can assist you better.",
        },
    };

    constructor(@InjectModel(Chat.name) private chatModel: Model<Chat>) {}

    async getAIResponse(userMessage: string, profession: string, sessionId: string): Promise<string> {
        const message = userMessage.toLowerCase();
        const professionResponses = this.responses[profession.toLowerCase()];

        if (!professionResponses) {
            return "Sorry, I don't understand this. Please elaborate more, or our experts will connect here shortly.";
        }

        if (/\bhi\b|\bhello\b/i.test(message)) {
            return professionResponses.greeting;
        }

        const commonResponse = professionResponses.commonQuery;
        return `${commonResponse} Our experts will connect with you soon, please wait for a while.`;
    }

    async saveChat(
        userMessage: string,
        aiResponse: string,
        profession: string,
        sessionId: string,
        sender: string
    ): Promise<Chat> {
        if (!userMessage) {
            throw new Error("User message cannot be empty");
        }

        const newMessage = {
            sender,
            message: userMessage,
            timestamp: new Date(),
        };

        const aiMessage = aiResponse
            ? {
                  sender: 'AI',
                  message: aiResponse,
                  timestamp: new Date(),
              }
            : null;

        const existingChat = await this.chatModel.findOne({ sessionId });

        if (existingChat) {
            existingChat.messages.push(newMessage);
            if (aiMessage) existingChat.messages.push(aiMessage);
            return existingChat.save();
        } else {
            const messages = aiMessage
                ? [newMessage, aiMessage]
                : [newMessage];

            const newChat = new this.chatModel({
                sessionId,
                profession,
                messages,
            });

            return newChat.save();
        }
    }
    async getChatMessages(sessionId: string): Promise<{ sender: string; message: string; timestamp: Date }[]> {
        const chat = await this.chatModel.findOne({ sessionId });
        return chat ? chat.messages : [];
    }

    generateSessionId(): string {
        return uuid.v4();
    }

    getGreetingMessage(profession: string): string {
        const professionResponses = this.responses[profession.toLowerCase()];
        return professionResponses?.greeting || "Hello! How can I assist you today?";
    }

    async getAllChats(): Promise<Chat[]> {
        return this.chatModel.find().sort({ createdAt: 1 }).exec();
    }
}
