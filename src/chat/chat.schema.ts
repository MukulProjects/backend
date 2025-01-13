import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class Chat extends Document {
  @Prop({ required: true })
  sessionId: string; // Unique session ID for each chat session

  @Prop({ required: true })
  profession: string;

  @Prop({
    type: [
      {
        sender: { type: String, required: true }, // 'user' or 'admin'
        message: { type: String, required: true },
        timestamp: { type: Date, default: Date.now }, // Optional for message timestamp
      },
    ],
    default: [],
  })
  messages: { sender: string; message: string; timestamp: Date }[];
}

export const ChatSchema = SchemaFactory.createForClass(Chat);

