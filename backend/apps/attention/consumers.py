"""
WebSocket consumers for real-time gaze tracking.
"""
import json
import logging
import asyncio
from typing import Dict, Any
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError

from .models import Session
from .services import process_gaze_batch

User = get_user_model()
logger = logging.getLogger(__name__)


class GazeConsumer(AsyncWebsocketConsumer):
    """WebSocket consumer for real-time gaze tracking."""
    
    async def connect(self):
        """Handle WebSocket connection."""
        self.session_id = self.scope['url_route']['kwargs']['session_id']
        self.session_group_name = f'gaze_{self.session_id}'
        
        # Authenticate user
        user = await self.authenticate_user()
        if not user or user.is_anonymous:
            await self.close()
            return
        
        # Verify session ownership
        session = await self.get_session()
        if not session or session.user != user:
            await self.close()
            return
        
        # Join session group
        await self.channel_layer.group_add(
            self.session_group_name,
            self.channel_name
        )
        
        await self.accept()
        
        # Send initial connection confirmation
        await self.send(text_data=json.dumps({
            'type': 'connection_established',
            'session_id': self.session_id,
            'timestamp': self.get_timestamp()
        }))
        
        # Start keepalive task
        self.keepalive_task = asyncio.create_task(self.keepalive())
        
        logger.info(f"User {user.email} connected to gaze session {self.session_id}")
    
    async def disconnect(self, close_code):
        """Handle WebSocket disconnection."""
        # Cancel keepalive task
        if hasattr(self, 'keepalive_task'):
            self.keepalive_task.cancel()
        
        # Leave session group
        await self.channel_layer.group_discard(
            self.session_group_name,
            self.channel_name
        )
        
        logger.info(f"Gaze session {self.session_id} disconnected with code {close_code}")
    
    async def receive(self, text_data):
        """Handle incoming WebSocket messages."""
        try:
            data = json.loads(text_data)
            message_type = data.get('type')
            
            if message_type == 'gaze_samples':
                await self.handle_gaze_samples(data)
            elif message_type == 'ping':
                await self.handle_ping(data)
            else:
                logger.warning(f"Unknown message type: {message_type}")
                
        except json.JSONDecodeError:
            logger.error("Invalid JSON received")
        except Exception as e:
            logger.error(f"Error processing message: {e}")
    
    async def handle_gaze_samples(self, data: Dict[str, Any]):
        """Handle gaze sample data."""
        try:
            # Validate data structure
            if 'clientTimebaseMs' not in data or 'samples' not in data:
                await self.send_error("Invalid gaze data format")
                return
            
            # Process the batch
            batch_data = {
                'client_timebase_ms': data['clientTimebaseMs'],
                'samples': data['samples']
            }
            
            # Get session for processing
            session = await self.get_session()
            if not session:
                await self.send_error("Session not found")
                return
            
            # Process batch (this will be async in the future)
            result = await self.process_gaze_batch_async(session, batch_data)
            
            # Send acknowledgment
            await self.send(text_data=json.dumps({
                'type': 'gaze_ack',
                'accepted': result['accepted'],
                'dropped': result['dropped'],
                'timestamp': self.get_timestamp()
            }))
            
        except Exception as e:
            logger.error(f"Error handling gaze samples: {e}")
            await self.send_error("Error processing gaze data")
    
    async def handle_ping(self, data: Dict[str, Any]):
        """Handle ping message."""
        await self.send(text_data=json.dumps({
            'type': 'pong',
            'timestamp': self.get_timestamp()
        }))
    
    async def attention_event(self, event):
        """Handle attention event from group."""
        await self.send(text_data=json.dumps({
            'type': 'attention_event',
            'event': event['event'],
            'timestamp': self.get_timestamp()
        }))
    
    async def intervention(self, event):
        """Handle intervention from group."""
        await self.send(text_data=json.dumps({
            'type': 'intervention',
            'action': event['action'],
            'timestamp': self.get_timestamp()
        }))
    
    async def keepalive(self):
        """Send keepalive messages every 20 seconds."""
        while True:
            try:
                await asyncio.sleep(20)
                await self.send(text_data=json.dumps({
                    'type': 'keepalive',
                    'timestamp': self.get_timestamp()
                }))
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in keepalive: {e}")
                break
    
    async def send_error(self, message: str):
        """Send error message to client."""
        await self.send(text_data=json.dumps({
            'type': 'error',
            'message': message,
            'timestamp': self.get_timestamp()
        }))
    
    def get_timestamp(self) -> int:
        """Get current timestamp in milliseconds."""
        import time
        return int(time.time() * 1000)
    
    async def authenticate_user(self) -> User:
        """Authenticate user from WebSocket connection."""
        # Try to get token from query parameters
        token = self.scope.get('query_string', b'').decode().split('token=')[-1].split('&')[0]
        
        if not token:
            # Try to get token from cookies
            cookies = self.scope.get('cookies', {})
            token = cookies.get('access_token')
        
        if not token:
            return AnonymousUser()
        
        try:
            # Validate JWT token
            access_token = AccessToken(token)
            user_id = access_token['user_id']
            user = await self.get_user_by_id(user_id)
            return user
        except (InvalidToken, TokenError, KeyError):
            return AnonymousUser()
    
    @database_sync_to_async
    def get_user_by_id(self, user_id: int) -> User:
        """Get user by ID."""
        try:
            return User.objects.get(id=user_id)
        except User.DoesNotExist:
            return AnonymousUser()
    
    @database_sync_to_async
    def get_session(self) -> Session:
        """Get session by ID."""
        try:
            return Session.objects.get(id=self.session_id)
        except Session.DoesNotExist:
            return None
    
    @database_sync_to_async
    def process_gaze_batch_async(self, session: Session, batch_data: Dict[str, Any]) -> Dict[str, int]:
        """Process gaze batch asynchronously."""
        return process_gaze_batch(session, batch_data)


class SessionConsumer(AsyncWebsocketConsumer):
    """WebSocket consumer for session management."""
    
    async def connect(self):
        """Handle WebSocket connection."""
        self.user = self.scope['user']
        
        if self.user.is_anonymous:
            await self.close()
            return
        
        self.user_group_name = f'user_{self.user.id}'
        
        # Join user group
        await self.channel_layer.group_add(
            self.user_group_name,
            self.channel_name
        )
        
        await self.accept()
        
        logger.info(f"User {self.user.email} connected to session management")
    
    async def disconnect(self, close_code):
        """Handle WebSocket disconnection."""
        # Leave user group
        await self.channel_layer.group_discard(
            self.user_group_name,
            self.channel_name
        )
        
        logger.info(f"User {self.user.email} disconnected from session management")
    
    async def receive(self, text_data):
        """Handle incoming WebSocket messages."""
        try:
            data = json.loads(text_data)
            message_type = data.get('type')
            
            if message_type == 'ping':
                await self.handle_ping(data)
            else:
                logger.warning(f"Unknown message type: {message_type}")
                
        except json.JSONDecodeError:
            logger.error("Invalid JSON received")
        except Exception as e:
            logger.error(f"Error processing message: {e}")
    
    async def handle_ping(self, data: Dict[str, Any]):
        """Handle ping message."""
        await self.send(text_data=json.dumps({
            'type': 'pong',
            'timestamp': self.get_timestamp()
        }))
    
    async def session_update(self, event):
        """Handle session update from group."""
        await self.send(text_data=json.dumps({
            'type': 'session_update',
            'session': event['session'],
            'timestamp': self.get_timestamp()
        }))
    
    def get_timestamp(self) -> int:
        """Get current timestamp in milliseconds."""
        import time
        return int(time.time() * 1000)
