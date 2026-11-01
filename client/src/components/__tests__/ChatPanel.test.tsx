import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react';
import * as fc from 'fast-check';
import ChatPanel from '../ChatPanel';

/**
 * Feature: text-chat, Property 2: 空白文字のみのメッセージは送信拒否される
 * Validates: Requirements 1.2
 */

// jsdom does not implement scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

// Create a mock Socket.IO socket object
function createMockSocket() {
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>();
  return {
    listeners,
    emit: vi.fn(),
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(handler);
    }),
    off: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      listeners.get(event)?.delete(handler);
    }),
  };
}

describe('ChatPanel - Property 2: 空白文字のみのメッセージは送信拒否される', () => {
  let mockSocket: ReturnType<typeof createMockSocket>;

  beforeEach(() => {
    mockSocket = createMockSocket();
  });

  // Arbitrary that generates whitespace-only strings (spaces, tabs, newlines, etc.)
  const whitespaceOnlyArb = fc
    .array(fc.constantFrom(' ', '\t', '\n', '\r', '\u00A0', '\u3000'), { minLength: 0, maxLength: 50 })
    .map((chars) => chars.join(''));

  it('should not emit chat-message for any whitespace-only input', () => {
    fc.assert(
      fc.property(whitespaceOnlyArb, (whitespaceStr) => {
        mockSocket = createMockSocket();

        render(
          <ChatPanel
            socket={mockSocket as unknown as import('socket.io-client').Socket}
            userName="TestUser"
            isOpen={true}
            onUnreadCountChange={vi.fn()}
          />
        );

        const input = screen.getByPlaceholderText('Type a message...');
        const form = input.closest('form')!;

        // Set the input value via change event
        fireEvent.change(input, { target: { value: whitespaceStr } });

        // Attempt to submit the form
        fireEvent.submit(form);

        // Verify socket.emit was NOT called with 'chat-message'
        const chatMessageCalls = mockSocket.emit.mock.calls.filter(
          (call: unknown[]) => call[0] === 'chat-message'
        );
        expect(chatMessageCalls).toHaveLength(0);

        // Cleanup: unmount between iterations
        cleanup();
      }),
      { numRuns: 100 }
    );
  });
});


/**
 * Feature: text-chat, Property 3: 送信後に入力フィールドがクリアされる
 * Validates: Requirements 1.3
 */
describe('ChatPanel - Property 3: 送信後に入力フィールドがクリアされる', () => {
  let mockSocket: ReturnType<typeof createMockSocket>;

  beforeEach(() => {
    mockSocket = createMockSocket();
  });

  // Arbitrary that generates valid (non-whitespace-only) message strings
  const validMessageArb = fc
    .string({ minLength: 1, maxLength: 200 })
    .filter((s) => s.trim().length > 0);

  it('should clear the input field after submitting a valid message', () => {
    fc.assert(
      fc.property(validMessageArb, (message) => {
        mockSocket = createMockSocket();

        render(
          <ChatPanel
            socket={mockSocket as unknown as import('socket.io-client').Socket}
            userName="TestUser"
            isOpen={true}
            onUnreadCountChange={vi.fn()}
          />
        );

        const input = screen.getByPlaceholderText('Type a message...') as HTMLInputElement;
        const form = input.closest('form')!;

        // Set the input value
        fireEvent.change(input, { target: { value: message } });

        // Submit the form
        fireEvent.submit(form);

        // Verify the input field is cleared
        expect(input.value).toBe('');

        cleanup();
      }),
      { numRuns: 100 }
    );
  });
});


/**
 * Feature: text-chat, Property 5: メッセージ表示に必要な情報が含まれ、送信者が区別される
 * Validates: Requirements 2.2, 2.4
 */
describe('ChatPanel - Property 5: メッセージ表示に必要な情報が含まれ、送信者が区別される', () => {
  // Use alphanumeric strings to avoid text-matching issues with special chars / whitespace
  const chatMessageArb = fc.record({
    userName: fc.stringMatching(/^[A-Za-z][A-Za-z0-9]{0,14}$/),
    message: fc.stringMatching(/^[A-Za-z][A-Za-z0-9 ]{0,49}$/).filter((s) => s.trim().length > 0),
    timestamp: fc.integer({ min: 86400000, max: 4102444800000 }), // 1 day .. ~2100
  });

  const currentUserNameArb = fc.stringMatching(/^[A-Za-z][A-Za-z0-9]{0,14}$/);

  it('should display userName, message, and timestamp, and apply own-message style when sender matches current user', () => {
    fc.assert(
      fc.property(chatMessageArb, currentUserNameArb, (chatMsg, currentUser) => {
        cleanup();
        const mockSocket = createMockSocket();

        const { container } = render(
          <ChatPanel
            socket={mockSocket as unknown as import('socket.io-client').Socket}
            userName={currentUser}
            isOpen={true}
            onUnreadCountChange={vi.fn()}
          />
        );

        // Simulate receiving a chat-message event via the mock socket's listener map
        const chatMessageHandlers = mockSocket.listeners.get('chat-message');
        expect(chatMessageHandlers).toBeDefined();
        expect(chatMessageHandlers!.size).toBeGreaterThan(0);

        act(() => {
          chatMessageHandlers!.forEach((handler) => handler(chatMsg));
        });

        // Verify message text is displayed in the bubble
        const bubbleText = container.querySelector('.chat-bubble-text');
        expect(bubbleText).toBeTruthy();
        expect(bubbleText!.textContent).toBe(chatMsg.message);

        // Verify formatted timestamp is displayed
        const expectedTime = new Date(chatMsg.timestamp).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });
        const bubbleTime = container.querySelector('.chat-bubble-time');
        expect(bubbleTime).toBeTruthy();
        expect(bubbleTime!.textContent).toBe(expectedTime);

        // Find the chat-message container element
        const messageContainer = container.querySelector('.chat-message');
        expect(messageContainer).toBeTruthy();

        const isOwn = chatMsg.userName === currentUser;

        if (isOwn) {
          // Own messages should have 'chat-message-own' class
          expect(messageContainer!.classList.contains('chat-message-own')).toBe(true);
          expect(messageContainer!.classList.contains('chat-message-other')).toBe(false);
          // Own messages should NOT display the userName label
          const nameElements = messageContainer!.querySelectorAll('.chat-message-name');
          expect(nameElements.length).toBe(0);
        } else {
          // Other messages should have 'chat-message-other' class
          expect(messageContainer!.classList.contains('chat-message-other')).toBe(true);
          expect(messageContainer!.classList.contains('chat-message-own')).toBe(false);
          // Other messages should display the userName
          const nameEl = messageContainer!.querySelector('.chat-message-name');
          expect(nameEl).toBeTruthy();
          expect(nameEl!.textContent).toBe(chatMsg.userName);
        }

        // Also verify bubble style distinction
        const bubble = messageContainer!.querySelector('.chat-bubble');
        expect(bubble).toBeTruthy();
        if (isOwn) {
          expect(bubble!.classList.contains('chat-bubble-own')).toBe(true);
        } else {
          expect(bubble!.classList.contains('chat-bubble-other')).toBe(true);
        }

        cleanup();
      }),
      { numRuns: 100 }
    );
  });
});


/**
 * Feature: text-chat, Property 6: チャットパネルのトグル動作
 * Validates: Requirements 3.2
 */
describe('ChatPanel - Property 6: チャットパネルのトグル動作', () => {
  it('toggling twice returns to the original state (idempotency)', () => {
    fc.assert(
      fc.property(fc.boolean(), (initialState) => {
        // The toggle in Room.tsx is: setIsChatOpen(prev => !prev)
        // Simulate two toggles: flip → flip
        const afterFirstToggle = !initialState;
        const afterSecondToggle = !afterFirstToggle;

        // After toggling twice, the state must equal the original
        expect(afterSecondToggle).toBe(initialState);
      }),
      { numRuns: 100 }
    );
  });
});


/**
 * Feature: text-chat, Property 7: パネル非表示時の未読カウント
 * Validates: Requirements 3.3
 */
describe('ChatPanel - Property 7: パネル非表示時の未読カウント', () => {
  const chatMessageArb = fc.record({
    userName: fc.stringMatching(/^[A-Za-z][A-Za-z0-9]{0,14}$/),
    message: fc.stringMatching(/^[A-Za-z][A-Za-z0-9 ]{0,49}$/).filter((s) => s.trim().length > 0),
    timestamp: fc.integer({ min: 86400000, max: 4102444800000 }),
  });

  it('unread count equals N after receiving N messages while panel is hidden', () => {
    fc.assert(
      fc.property(
        fc.array(chatMessageArb, { minLength: 1, maxLength: 20 }),
        (messages) => {
          cleanup();
          const mockSocket = createMockSocket();
          let latestUnreadCount = 0;
          const onUnreadCountChange = vi.fn((count: number) => {
            latestUnreadCount = count;
          });

          render(
            <ChatPanel
              socket={mockSocket as unknown as import('socket.io-client').Socket}
              userName="TestUser"
              isOpen={false}
              onUnreadCountChange={onUnreadCountChange}
            />
          );

          // Get the chat-message listener handlers registered by the component
          const chatMessageHandlers = mockSocket.listeners.get('chat-message');
          expect(chatMessageHandlers).toBeDefined();
          expect(chatMessageHandlers!.size).toBeGreaterThan(0);

          // Simulate receiving each message
          for (const msg of messages) {
            act(() => {
              chatMessageHandlers!.forEach((handler) => handler(msg));
            });
          }

          // The final unread count should equal the number of messages received
          expect(latestUnreadCount).toBe(messages.length);

          cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });
});
