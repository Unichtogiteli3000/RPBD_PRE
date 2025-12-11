from flask import Flask, request, jsonify, session
import psycopg2
from psycopg2.extras import RealDictCursor
from werkzeug.security import generate_password_hash, check_password_hash
import os
from datetime import datetime, timedelta
import jwt
from functools import wraps
from flask_cors import CORS

app = Flask(__name__, static_folder='client', template_folder='client')
CORS(app)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'your-secret-key-here')

# Database connection configuration
DB_CONFIG = {
    'host': os.environ.get('DB_HOST', 'localhost'),
    'database': os.environ.get('DB_NAME', 'music_library'),
    'user': os.environ.get('DB_USER', 'postgres'),
    'password': os.environ.get('DB_PASSWORD', 'password')
}

def get_db_connection():
    """Create a database connection"""
    conn = psycopg2.connect(**DB_CONFIG)
    return conn

def token_required(f):
    """Decorator to protect routes that require authentication"""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                token = auth_header.split(" ")[1]  # Bearer token
            except IndexError:
                return jsonify({'message': 'Invalid token format'}), 401
        
        if not token:
            return jsonify({'message': 'Token is missing'}), 401
        
        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            current_user_id = data['user_id']
            
            # Check if user still exists in database
            conn = get_db_connection()
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("SELECT user_id, login, first_name, last_name, email, avatar_url FROM \"user\" WHERE user_id = %s AND is_active = true", (current_user_id,))
            current_user = cursor.fetchone()
            cursor.close()
            conn.close()
            
            if not current_user:
                return jsonify({'message': 'User no longer exists'}), 401
                
        except jwt.ExpiredSignatureError:
            return jsonify({'message': 'Token has expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'message': 'Invalid token'}), 401
        
        return f(current_user, *args, **kwargs)
    
    return decorated

def admin_required(f):
    """Decorator to ensure only admin users can access certain routes"""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                token = auth_header.split(" ")[1]  # Bearer token
            except IndexError:
                return jsonify({'message': 'Invalid token format'}), 401
        
        if not token:
            return jsonify({'message': 'Token is missing'}), 401
        
        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            current_user_id = data['user_id']
            
            # Check if user is admin
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT is_admin FROM \"user\" WHERE user_id = %s AND is_active = true", (current_user_id,))
            result = cursor.fetchone()
            cursor.close()
            conn.close()
            
            if not result or not result[0]:
                return jsonify({'message': 'Admin access required'}), 403
                
        except jwt.ExpiredSignatureError:
            return jsonify({'message': 'Token has expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'message': 'Invalid token'}), 401
        
        return f(*args, **kwargs)
    
    return decorated

# Authentication routes
@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    login = data.get('login')
    password = data.get('password')
    
    if not login or not password:
        return jsonify({'message': 'Login and password required'}), 400
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Call stored procedure to authenticate user
        cursor.callproc('authenticate_user', (login, password))
        result = cursor.fetchone()
        
        if result and result['success']:
            user_data = result
            
            # Generate JWT token
            token = jwt.encode({
                'user_id': user_data['user_id'],
                'exp': datetime.utcnow() + timedelta(hours=24)
            }, app.config['SECRET_KEY'], algorithm='HS256')
            
            return jsonify({
                'token': token,
                'user': {
                    'user_id': user_data['user_id'],
                    'login': user_data['login'],
                    'first_name': user_data['first_name'],
                    'last_name': user_data['last_name'],
                    'email': user_data['email'],
                    'avatar_url': user_data['avatar_url'],
                    'is_admin': user_data['is_admin']
                }
            }), 200
        else:
            return jsonify({'message': 'Invalid credentials'}), 401
            
    except Exception as e:
        print(f"Login error: {str(e)}")
        return jsonify({'message': 'Authentication failed'}), 500
    finally:
        if 'conn' in locals():
            conn.close()

@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.get_json()
    login = data.get('login')
    password = data.get('password')
    first_name = data.get('first_name')
    last_name = data.get('last_name')
    email = data.get('email')
    
    if not login or not password:
        return jsonify({'message': 'Login and password required'}), 400
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Call stored procedure to register user
        cursor.callproc('register_user', (login, password, first_name, last_name, email))
        result = cursor.fetchone()
        
        if result and result['success']:
            user_data = result
            
            # Generate JWT token
            token = jwt.encode({
                'user_id': user_data['user_id'],
                'exp': datetime.utcnow() + timedelta(hours=24)
            }, app.config['SECRET_KEY'], algorithm='HS256')
            
            return jsonify({
                'token': token,
                'user': {
                    'user_id': user_data['user_id'],
                    'login': user_data['login'],
                    'first_name': user_data['first_name'],
                    'last_name': user_data['last_name'],
                    'email': user_data['email'],
                    'avatar_url': user_data['avatar_url'],
                    'is_admin': user_data['is_admin']
                }
            }), 201
        else:
            return jsonify({'message': 'Registration failed'}), 400
            
    except Exception as e:
        print(f"Registration error: {str(e)}")
        return jsonify({'message': 'Registration failed'}), 500
    finally:
        if 'conn' in locals():
            conn.close()

# User profile routes
@app.route('/api/profile', methods=['GET'])
@token_required
def get_profile(current_user):
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Get user profile with favorite genres and artists
        cursor.callproc('get_user_profile', (current_user['user_id'],))
        profile = cursor.fetchone()
        
        if profile:
            # Get favorite genres
            cursor.callproc('get_user_favorite_genres', (current_user['user_id'],))
            favorite_genres = cursor.fetchall()
            
            # Get favorite artists
            cursor.callproc('get_user_favorite_artists', (current_user['user_id'],))
            favorite_artists = cursor.fetchall()
            
            profile_result = dict(profile)
            profile_result['favorite_genres'] = favorite_genres
            profile_result['favorite_artists'] = favorite_artists
            
            return jsonify(profile_result), 200
        else:
            return jsonify({'message': 'User not found'}), 404
            
    except Exception as e:
        print(f"Get profile error: {str(e)}")
        return jsonify({'message': 'Failed to get profile'}), 500
    finally:
        if 'conn' in locals():
            conn.close()

@app.route('/api/profile', methods=['PUT'])
@token_required
def update_profile(current_user):
    data = request.get_json()
    
    first_name = data.get('first_name')
    last_name = data.get('last_name')
    email = data.get('email')
    avatar_url = data.get('avatar_url')
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Call stored procedure to update profile
        cursor.callproc('update_user_profile', (
            current_user['user_id'], first_name, last_name, email, avatar_url
        ))
        result = cursor.fetchone()
        
        if result and result['success']:
            return jsonify({'message': 'Profile updated successfully'}), 200
        else:
            return jsonify({'message': 'Failed to update profile'}), 400
            
    except Exception as e:
        print(f"Update profile error: {str(e)}")
        return jsonify({'message': 'Failed to update profile'}), 500
    finally:
        if 'conn' in locals():
            conn.close()

# Genre routes
@app.route('/api/genres', methods=['GET'])
@token_required
def get_genres(current_user):
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        cursor.callproc('get_all_genres')
        genres = cursor.fetchall()
        
        return jsonify(genres), 200
        
    except Exception as e:
        print(f"Get genres error: {str(e)}")
        return jsonify({'message': 'Failed to get genres'}), 500
    finally:
        if 'conn' in locals():
            conn.close()

# Artist routes
@app.route('/api/artists', methods=['GET'])
@token_required
def get_artists(current_user):
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Get all artists
        cursor.callproc('get_all_artists')
        artists = cursor.fetchall()
        
        return jsonify(artists), 200
        
    except Exception as e:
        print(f"Get artists error: {str(e)}")
        return jsonify({'message': 'Failed to get artists'}), 500
    finally:
        if 'conn' in locals():
            conn.close()

@app.route('/api/artists', methods=['POST'])
@token_required
def add_artist(current_user):
    data = request.get_json()
    name = data.get('name')
    
    if not name:
        return jsonify({'message': 'Artist name is required'}), 400
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        cursor.callproc('add_artist', (name,))
        result = cursor.fetchone()
        
        if result and result['artist_id']:
            return jsonify(result), 201
        else:
            return jsonify({'message': 'Failed to add artist'}), 400
            
    except Exception as e:
        print(f"Add artist error: {str(e)}")
        return jsonify({'message': 'Failed to add artist'}), 500
    finally:
        if 'conn' in locals():
            conn.close()

@app.route('/api/artists/<int:artist_id>', methods=['PUT'])
@token_required
def update_artist(current_user, artist_id):
    data = request.get_json()
    name = data.get('name')
    
    if not name:
        return jsonify({'message': 'Artist name is required'}), 400
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        cursor.callproc('update_artist', (artist_id, name))
        result = cursor.fetchone()
        
        if result and result['success']:
            return jsonify({'message': 'Artist updated successfully'}), 200
        else:
            return jsonify({'message': 'Failed to update artist'}), 400
            
    except Exception as e:
        print(f"Update artist error: {str(e)}")
        return jsonify({'message': 'Failed to update artist'}), 500
    finally:
        if 'conn' in locals():
            conn.close()

@app.route('/api/artists/<int:artist_id>', methods=['DELETE'])
@token_required
def delete_artist(current_user, artist_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        cursor.callproc('delete_artist', (artist_id,))
        result = cursor.fetchone()
        
        if result and result['success']:
            return jsonify({'message': 'Artist deleted successfully'}), 200
        else:
            return jsonify({'message': 'Failed to delete artist'}), 400
            
    except Exception as e:
        print(f"Delete artist error: {str(e)}")
        return jsonify({'message': 'Failed to delete artist'}), 500
    finally:
        if 'conn' in locals():
            conn.close()

# Track routes
@app.route('/api/tracks', methods=['GET'])
@token_required
def get_tracks(current_user):
    # Check if user is admin to determine if they can see all tracks
    is_admin = current_user.get('is_admin', False)
    user_id = current_user['user_id'] if not is_admin else None
    
    # Get filters from query parameters
    title_filter = request.args.get('title')
    artist_filter = request.args.get('artist')
    genre_filter = request.args.get('genre_id')
    bpm_filter = request.args.get('bpm')
    duration_filter = request.args.get('duration')
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Call appropriate stored procedure based on admin status
        if is_admin:
            cursor.callproc('get_all_tracks_admin')
        else:
            cursor.callproc('get_user_tracks', (user_id,))
        
        tracks = cursor.fetchall()
        
        return jsonify(tracks), 200
        
    except Exception as e:
        print(f"Get tracks error: {str(e)}")
        return jsonify({'message': 'Failed to get tracks'}), 500
    finally:
        if 'conn' in locals():
            conn.close()

@app.route('/api/tracks', methods=['POST'])
@token_required
def add_track(current_user):
    data = request.get_json()
    
    title = data.get('title')
    artist_id = data.get('artist_id')
    genre_id = data.get('genre_id')
    bpm = data.get('bpm')
    duration_sec = data.get('duration_sec')
    
    if not title or not artist_id or not genre_id:
        return jsonify({'message': 'Title, artist, and genre are required'}), 400
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        cursor.callproc('add_track', (
            current_user['user_id'], title, artist_id, genre_id, bpm, duration_sec
        ))
        result = cursor.fetchone()
        
        if result and result['track_id']:
            return jsonify(result), 201
        else:
            return jsonify({'message': 'Failed to add track'}), 400
            
    except Exception as e:
        print(f"Add track error: {str(e)}")
        return jsonify({'message': 'Failed to add track'}), 500
    finally:
        if 'conn' in locals():
            conn.close()

@app.route('/api/tracks/<int:track_id>', methods=['PUT'])
@token_required
def update_track(current_user, track_id):
    data = request.get_json()
    
    title = data.get('title')
    artist_id = data.get('artist_id')
    genre_id = data.get('genre_id')
    bpm = data.get('bpm')
    duration_sec = data.get('duration_sec')
    
    if not title or not artist_id or not genre_id:
        return jsonify({'message': 'Title, artist, and genre are required'}), 400
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # First, check if the track belongs to the current user (unless admin)
        if not current_user.get('is_admin'):
            cursor.execute("SELECT user_id FROM tracks WHERE track_id = %s", (track_id,))
            track_owner = cursor.fetchone()
            if not track_owner or track_owner['user_id'] != current_user['user_id']:
                return jsonify({'message': 'Not authorized to modify this track'}), 403
        
        cursor.callproc('update_track', (
            track_id, title, artist_id, genre_id, bpm, duration_sec
        ))
        result = cursor.fetchone()
        
        if result and result['success']:
            return jsonify({'message': 'Track updated successfully'}), 200
        else:
            return jsonify({'message': 'Failed to update track'}), 400
            
    except Exception as e:
        print(f"Update track error: {str(e)}")
        return jsonify({'message': 'Failed to update track'}), 500
    finally:
        if 'conn' in locals():
            conn.close()

@app.route('/api/tracks/<int:track_id>', methods=['DELETE'])
@token_required
def delete_track(current_user, track_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # First, check if the track belongs to the current user (unless admin)
        if not current_user.get('is_admin'):
            cursor.execute("SELECT user_id FROM tracks WHERE track_id = %s", (track_id,))
            track_owner = cursor.fetchone()
            if not track_owner or track_owner['user_id'] != current_user['user_id']:
                return jsonify({'message': 'Not authorized to delete this track'}), 403
        
        cursor.callproc('delete_track', (track_id,))
        result = cursor.fetchone()
        
        if result and result['success']:
            return jsonify({'message': 'Track deleted successfully'}), 200
        else:
            return jsonify({'message': 'Failed to delete track'}), 400
            
    except Exception as e:
        print(f"Delete track error: {str(e)}")
        return jsonify({'message': 'Failed to delete track'}), 500
    finally:
        if 'conn' in locals():
            conn.close()

# Collection routes
@app.route('/api/collections', methods=['GET'])
@token_required
def get_collections(current_user):
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        cursor.callproc('get_user_collections', (current_user['user_id'],))
        collections = cursor.fetchall()
        
        return jsonify(collections), 200
        
    except Exception as e:
        print(f"Get collections error: {str(e)}")
        return jsonify({'message': 'Failed to get collections'}), 500
    finally:
        if 'conn' in locals():
            conn.close()

@app.route('/api/collections', methods=['POST'])
@token_required
def add_collection(current_user):
    data = request.get_json()
    
    name = data.get('name')
    is_favorite = data.get('is_favorite', False)
    
    if not name:
        return jsonify({'message': 'Collection name is required'}), 400
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        cursor.callproc('create_collection', (current_user['user_id'], name, is_favorite))
        result = cursor.fetchone()
        
        if result and result['collection_id']:
            return jsonify(result), 201
        else:
            return jsonify({'message': 'Failed to create collection'}), 400
            
    except Exception as e:
        print(f"Add collection error: {str(e)}")
        return jsonify({'message': 'Failed to create collection'}), 500
    finally:
        if 'conn' in locals():
            conn.close()

@app.route('/api/collections/<int:collection_id>', methods=['PUT'])
@token_required
def update_collection(current_user, collection_id):
    data = request.get_json()
    
    name = data.get('name')
    is_favorite = data.get('is_favorite')
    
    if not name:
        return jsonify({'message': 'Collection name is required'}), 400
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # First, check if the collection belongs to the current user
        cursor.execute("SELECT user_id FROM collections WHERE collection_id = %s", (collection_id,))
        collection_owner = cursor.fetchone()
        if not collection_owner or collection_owner['user_id'] != current_user['user_id']:
            return jsonify({'message': 'Not authorized to modify this collection'}), 403
        
        cursor.callproc('update_collection', (collection_id, name, is_favorite))
        result = cursor.fetchone()
        
        if result and result['success']:
            return jsonify({'message': 'Collection updated successfully'}), 200
        else:
            return jsonify({'message': 'Failed to update collection'}), 400
            
    except Exception as e:
        print(f"Update collection error: {str(e)}")
        return jsonify({'message': 'Failed to update collection'}), 500
    finally:
        if 'conn' in locals():
            conn.close()

@app.route('/api/collections/<int:collection_id>', methods=['DELETE'])
@token_required
def delete_collection(current_user, collection_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # First, check if the collection belongs to the current user
        cursor.execute("SELECT user_id FROM collections WHERE collection_id = %s", (collection_id,))
        collection_owner = cursor.fetchone()
        if not collection_owner or collection_owner['user_id'] != current_user['user_id']:
            return jsonify({'message': 'Not authorized to delete this collection'}), 403
        
        cursor.callproc('delete_collection', (collection_id,))
        result = cursor.fetchone()
        
        if result and result['success']:
            return jsonify({'message': 'Collection deleted successfully'}), 200
        else:
            return jsonify({'message': 'Failed to delete collection'}), 400
            
    except Exception as e:
        print(f"Delete collection error: {str(e)}")
        return jsonify({'message': 'Failed to delete collection'}), 500
    finally:
        if 'conn' in locals():
            conn.close()

# Add track to collection
@app.route('/api/collections/<int:collection_id>/tracks', methods=['POST'])
@token_required
def add_track_to_collection(current_user, collection_id):
    data = request.get_json()
    track_id = data.get('track_id')
    
    if not track_id:
        return jsonify({'message': 'Track ID is required'}), 400
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Check if collection belongs to user
        cursor.execute("SELECT user_id FROM collections WHERE collection_id = %s", (collection_id,))
        collection_owner = cursor.fetchone()
        if not collection_owner or collection_owner['user_id'] != current_user['user_id']:
            return jsonify({'message': 'Not authorized to modify this collection'}), 403
        
        # Check if track belongs to user (or if admin)
        if not current_user.get('is_admin'):
            cursor.execute("SELECT user_id FROM tracks WHERE track_id = %s", (track_id,))
            track_owner = cursor.fetchone()
            if not track_owner or track_owner['user_id'] != current_user['user_id']:
                return jsonify({'message': 'Not authorized to add this track to collection'}), 403
        
        cursor.callproc('add_track_to_collection', (collection_id, track_id))
        result = cursor.fetchone()
        
        if result and result['success']:
            return jsonify({'message': 'Track added to collection successfully'}), 200
        else:
            return jsonify({'message': 'Failed to add track to collection'}), 400
            
    except Exception as e:
        print(f"Add track to collection error: {str(e)}")
        return jsonify({'message': 'Failed to add track to collection'}), 500
    finally:
        if 'conn' in locals():
            conn.close()

# Remove track from collection
@app.route('/api/collections/<int:collection_id>/tracks/<int:track_id>', methods=['DELETE'])
@token_required
def remove_track_from_collection(current_user, collection_id, track_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Check if collection belongs to user
        cursor.execute("SELECT user_id FROM collections WHERE collection_id = %s", (collection_id,))
        collection_owner = cursor.fetchone()
        if not collection_owner or collection_owner['user_id'] != current_user['user_id']:
            return jsonify({'message': 'Not authorized to modify this collection'}), 403
        
        cursor.callproc('remove_track_from_collection', (collection_id, track_id))
        result = cursor.fetchone()
        
        if result and result['success']:
            return jsonify({'message': 'Track removed from collection successfully'}), 200
        else:
            return jsonify({'message': 'Failed to remove track from collection'}), 400
            
    except Exception as e:
        print(f"Remove track from collection error: {str(e)}")
        return jsonify({'message': 'Failed to remove track from collection'}), 500
    finally:
        if 'conn' in locals():
            conn.close()

# Search routes
@app.route('/api/search/tracks', methods=['GET'])
@token_required
def search_tracks(current_user):
    title = request.args.get('title')
    artist = request.args.get('artist')
    genre_id = request.args.get('genre_id')
    bpm = request.args.get('bpm')
    duration = request.args.get('duration')
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Call search procedure
        cursor.callproc('search_tracks', (title, artist, genre_id, bpm, duration))
        results = cursor.fetchall()
        
        return jsonify(results), 200
        
    except Exception as e:
        print(f"Search tracks error: {str(e)}")
        return jsonify({'message': 'Search failed'}), 500
    finally:
        if 'conn' in locals():
            conn.close()

# Admin routes
@app.route('/api/admin/users', methods=['GET'])
@admin_required
def get_all_users():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        cursor.callproc('get_all_users_admin')
        users = cursor.fetchall()
        
        return jsonify(users), 200
        
    except Exception as e:
        print(f"Get all users error: {str(e)}")
        return jsonify({'message': 'Failed to get users'}), 500
    finally:
        if 'conn' in locals():
            conn.close()

@app.route('/api/admin/tracks', methods=['GET'])
@admin_required
def get_all_tracks_admin():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        cursor.callproc('get_all_tracks_admin')
        tracks = cursor.fetchall()
        
        return jsonify(tracks), 200
        
    except Exception as e:
        print(f"Get all tracks admin error: {str(e)}")
        return jsonify({'message': 'Failed to get tracks'}), 500
    finally:
        if 'conn' in locals():
            conn.close()

@app.route('/api/admin/audit', methods=['GET'])
@admin_required
def get_audit_log():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        cursor.callproc('get_audit_log')
        audit_entries = cursor.fetchall()
        
        return jsonify(audit_entries), 200
        
    except Exception as e:
        print(f"Get audit log error: {str(e)}")
        return jsonify({'message': 'Failed to get audit log'}), 500
    finally:
        if 'conn' in locals():
            conn.close()

# Health check endpoint
@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy', 'timestamp': datetime.utcnow()}), 200

@app.route('/')
def index():
    return app.send_static_file('index.html')

@app.route('/login')
def login_page():
    return app.send_static_file('login.html')

@app.route('/register')
def register_page():
    return app.send_static_file('register.html')

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)