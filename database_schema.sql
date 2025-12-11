-- Музыкальная библиотека - Схема базы данных и хранимые процедуры

-- Таблица пользователей
CREATE TABLE IF NOT EXISTS "user" (
    user_id SERIAL PRIMARY KEY,
    login VARCHAR(50) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    email VARCHAR(100),
    avatar_url TEXT,
    is_admin BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица жанров
CREATE TABLE IF NOT EXISTS genres (
    genre_id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица исполнителей
CREATE TABLE IF NOT EXISTS artists (
    artist_id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица треков
CREATE TABLE IF NOT EXISTS tracks (
    track_id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    artist_id INTEGER NOT NULL,
    genre_id INTEGER NOT NULL,
    bpm INTEGER,
    duration_sec INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id INTEGER NOT NULL,
    FOREIGN KEY (artist_id) REFERENCES artists(artist_id),
    FOREIGN KEY (genre_id) REFERENCES genres(genre_id),
    FOREIGN KEY (user_id) REFERENCES "user"(user_id)
);

-- Таблица коллекций
CREATE TABLE IF NOT EXISTS collections (
    collection_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    is_favorite BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES "user"(user_id)
);

-- Таблица связи коллекций и треков
CREATE TABLE IF NOT EXISTS collection_tracks (
    collection_id INTEGER,
    track_id INTEGER,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (collection_id, track_id),
    FOREIGN KEY (collection_id) REFERENCES collections(collection_id) ON DELETE CASCADE,
    FOREIGN KEY (track_id) REFERENCES tracks(track_id) ON DELETE CASCADE
);

-- Таблица любимых жанров пользователя
CREATE TABLE IF NOT EXISTS user_favorite_genres (
    user_id INTEGER,
    genre_id INTEGER,
    PRIMARY KEY (user_id, genre_id),
    FOREIGN KEY (user_id) REFERENCES "user"(user_id) ON DELETE CASCADE,
    FOREIGN KEY (genre_id) REFERENCES genres(genre_id) ON DELETE CASCADE
);

-- Таблица любимых исполнителей пользователя
CREATE TABLE IF NOT EXISTS user_favorite_artists (
    user_id INTEGER,
    artist_id INTEGER,
    PRIMARY KEY (user_id, artist_id),
    FOREIGN KEY (user_id) REFERENCES "user"(user_id) ON DELETE CASCADE,
    FOREIGN KEY (artist_id) REFERENCES artists(artist_id) ON DELETE CASCADE
);

-- Таблица аудита
CREATE TABLE IF NOT EXISTS audit_log (
    log_id SERIAL PRIMARY KEY,
    user_id INTEGER,
    operation_type VARCHAR(20) NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
    table_name VARCHAR(50) NOT NULL,
    record_id INTEGER,
    operation_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    details JSONB,
    FOREIGN KEY (user_id) REFERENCES "user"(user_id)
);

-- Триггер для обновления времени изменения пользователя
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_updated_at 
    BEFORE UPDATE ON "user" 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Триггеры для аудита операций

-- Триггер для аудита операций с треками
CREATE OR REPLACE FUNCTION audit_track_operations()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        INSERT INTO audit_log (user_id, operation_type, table_name, record_id, details)
        VALUES (OLD.user_id, 'DELETE', 'tracks', OLD.track_id, 
                json_build_object('title', OLD.title, 'artist_id', OLD.artist_id, 'genre_id', OLD.genre_id));
        RETURN OLD;
    ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO audit_log (user_id, operation_type, table_name, record_id, details)
        VALUES (NEW.user_id, 'UPDATE', 'tracks', NEW.track_id, 
                json_build_object('old_title', OLD.title, 'new_title', NEW.title, 
                                 'old_artist_id', OLD.artist_id, 'new_artist_id', NEW.artist_id,
                                 'old_genre_id', OLD.genre_id, 'new_genre_id', NEW.genre_id));
        RETURN NEW;
    ELSIF (TG_OP = 'INSERT') THEN
        INSERT INTO audit_log (user_id, operation_type, table_name, record_id, details)
        VALUES (NEW.user_id, 'INSERT', 'tracks', NEW.track_id, 
                json_build_object('title', NEW.title, 'artist_id', NEW.artist_id, 'genre_id', NEW.genre_id));
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

CREATE TRIGGER audit_tracks_trigger
    AFTER INSERT OR UPDATE OR DELETE ON tracks
    FOR EACH ROW EXECUTE FUNCTION audit_track_operations();

-- Триггер для аудита операций с пользователями
CREATE OR REPLACE FUNCTION audit_user_operations()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        INSERT INTO audit_log (user_id, operation_type, table_name, record_id, details)
        VALUES (OLD.user_id, 'DELETE', 'user', OLD.user_id, 
                json_build_object('login', OLD.login));
        RETURN OLD;
    ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO audit_log (user_id, operation_type, table_name, record_id, details)
        VALUES (NEW.user_id, 'UPDATE', 'user', NEW.user_id, 
                json_build_object('old_login', OLD.login, 'new_login', NEW.login));
        RETURN NEW;
    ELSIF (TG_OP = 'INSERT') THEN
        INSERT INTO audit_log (user_id, operation_type, table_name, record_id, details)
        VALUES (NEW.user_id, 'INSERT', 'user', NEW.user_id, 
                json_build_object('login', NEW.login));
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

CREATE TRIGGER audit_users_trigger
    AFTER INSERT OR UPDATE OR DELETE ON "user"
    FOR EACH ROW EXECUTE FUNCTION audit_user_operations();

-- Хранимые процедуры

-- Процедура аутентификации пользователя
CREATE OR REPLACE FUNCTION authenticate_user(
    p_login VARCHAR(50),
    p_password VARCHAR(255)
)
RETURNS TABLE(
    success BOOLEAN,
    user_id INTEGER,
    login VARCHAR(50),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    email VARCHAR(100),
    avatar_url TEXT,
    is_admin BOOLEAN
) AS $$
DECLARE
    user_record RECORD;
    password_hash TEXT;
BEGIN
    SELECT u.*, pgp_sym_decrypt(u.password_hash::bytea, 'music_library_key') AS plain_password
    INTO user_record
    FROM "user" u
    WHERE u.login = p_login AND u.is_active = true;
    
    IF user_record IS NOT NULL THEN
        -- В реальной системе здесь должна быть проверка хэша пароля
        -- Для демонстрации просто возвращаем пользователя если найден
        password_hash := user_record.plain_password;
        
        IF password_hash = p_password THEN
            RETURN QUERY SELECT 
                true::BOOLEAN AS success,
                user_record.user_id,
                user_record.login,
                user_record.first_name,
                user_record.last_name,
                user_record.email,
                user_record.avatar_url,
                user_record.is_admin;
        ELSE
            RETURN QUERY SELECT 
                false::BOOLEAN AS success,
                NULL::INTEGER,
                NULL::VARCHAR(50),
                NULL::VARCHAR(100),
                NULL::VARCHAR(100),
                NULL::VARCHAR(100),
                NULL::TEXT,
                NULL::BOOLEAN;
        END IF;
    ELSE
        RETURN QUERY SELECT 
            false::BOOLEAN AS success,
            NULL::INTEGER,
            NULL::VARCHAR(50),
            NULL::VARCHAR(100),
            NULL::VARCHAR(100),
            NULL::VARCHAR(100),
            NULL::TEXT,
            NULL::BOOLEAN;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Процедура регистрации пользователя
CREATE OR REPLACE FUNCTION register_user(
    p_login VARCHAR(50),
    p_password VARCHAR(255),
    p_first_name VARCHAR(100),
    p_last_name VARCHAR(100),
    p_email VARCHAR(100)
)
RETURNS TABLE(
    success BOOLEAN,
    user_id INTEGER,
    login VARCHAR(50),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    email VARCHAR(100),
    avatar_url TEXT,
    is_admin BOOLEAN
) AS $$
DECLARE
    new_user_id INTEGER;
    encrypted_password TEXT;
BEGIN
    -- Шифруем пароль (в реальной системе используйте proper password hashing)
    encrypted_password := pgp_sym_encrypt(p_password, 'music_library_key');
    
    INSERT INTO "user" (login, password_hash, first_name, last_name, email, is_admin)
    VALUES (p_login, encrypted_password, p_first_name, p_last_name, p_email, false)
    RETURNING user_id INTO new_user_id;
    
    IF new_user_id IS NOT NULL THEN
        RETURN QUERY SELECT 
            true::BOOLEAN AS success,
            new_user_id,
            p_login,
            p_first_name,
            p_last_name,
            p_email,
            NULL::TEXT,
            false::BOOLEAN;
    ELSE
        RETURN QUERY SELECT 
            false::BOOLEAN AS success,
            NULL::INTEGER,
            NULL::VARCHAR(50),
            NULL::VARCHAR(100),
            NULL::VARCHAR(100),
            NULL::VARCHAR(100),
            NULL::TEXT,
            NULL::BOOLEAN;
    END IF;
EXCEPTION
    WHEN unique_violation THEN
        RETURN QUERY SELECT 
            false::BOOLEAN AS success,
            NULL::INTEGER,
            NULL::VARCHAR(50),
            NULL::VARCHAR(100),
            NULL::VARCHAR(100),
            NULL::VARCHAR(100),
            NULL::TEXT,
            NULL::BOOLEAN;
END;
$$ LANGUAGE plpgsql;

-- Процедура получения профиля пользователя
CREATE OR REPLACE FUNCTION get_user_profile(p_user_id INTEGER)
RETURNS TABLE(
    user_id INTEGER,
    login VARCHAR(50),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    email VARCHAR(100),
    avatar_url TEXT,
    is_admin BOOLEAN,
    created_at TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT u.user_id, u.login, u.first_name, u.last_name, u.email, u.avatar_url, u.is_admin, u.created_at
    FROM "user" u
    WHERE u.user_id = p_user_id AND u.is_active = true;
END;
$$ LANGUAGE plpgsql;

-- Процедура обновления профиля пользователя
CREATE OR REPLACE FUNCTION update_user_profile(
    p_user_id INTEGER,
    p_first_name VARCHAR(100),
    p_last_name VARCHAR(100),
    p_email VARCHAR(100),
    p_avatar_url TEXT
)
RETURNS TABLE(success BOOLEAN) AS $$
BEGIN
    UPDATE "user"
    SET first_name = COALESCE(p_first_name, first_name),
        last_name = COALESCE(p_last_name, last_name),
        email = COALESCE(p_email, email),
        avatar_url = COALESCE(p_avatar_url, avatar_url),
        updated_at = CURRENT_TIMESTAMP
    WHERE user_id = p_user_id AND is_active = true;
    
    IF FOUND THEN
        RETURN QUERY SELECT true::BOOLEAN;
    ELSE
        RETURN QUERY SELECT false::BOOLEAN;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Процедура получения любимых жанров пользователя
CREATE OR REPLACE FUNCTION get_user_favorite_genres(p_user_id INTEGER)
RETURNS TABLE(genre_id INTEGER, name VARCHAR(100)) AS $$
BEGIN
    RETURN QUERY
    SELECT g.genre_id, g.name
    FROM user_favorite_genres ufg
    JOIN genres g ON ufg.genre_id = g.genre_id
    WHERE ufg.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Процедура получения любимых исполнителей пользователя
CREATE OR REPLACE FUNCTION get_user_favorite_artists(p_user_id INTEGER)
RETURNS TABLE(artist_id INTEGER, name VARCHAR(100)) AS $$
BEGIN
    RETURN QUERY
    SELECT a.artist_id, a.name
    FROM user_favorite_artists ufa
    JOIN artists a ON ufa.artist_id = a.artist_id
    WHERE ufa.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Процедура получения всех жанров
CREATE OR REPLACE FUNCTION get_all_genres()
RETURNS TABLE(genre_id INTEGER, name VARCHAR(100), created_at TIMESTAMP) AS $$
BEGIN
    RETURN QUERY
    SELECT g.genre_id, g.name, g.created_at
    FROM genres g
    ORDER BY g.name;
END;
$$ LANGUAGE plpgsql;

-- Процедура получения всех исполнителей
CREATE OR REPLACE FUNCTION get_all_artists()
RETURNS TABLE(artist_id INTEGER, name VARCHAR(100), created_at TIMESTAMP) AS $$
BEGIN
    RETURN QUERY
    SELECT a.artist_id, a.name, a.created_at
    FROM artists a
    ORDER BY a.name;
END;
$$ LANGUAGE plpgsql;

-- Процедура добавления исполнителя
CREATE OR REPLACE FUNCTION add_artist(p_name VARCHAR(100))
RETURNS TABLE(artist_id INTEGER, name VARCHAR(100)) AS $$
DECLARE
    new_artist_id INTEGER;
BEGIN
    INSERT INTO artists (name)
    VALUES (p_name)
    RETURNING artist_id INTO new_artist_id;
    
    RETURN QUERY
    SELECT new_artist_id, p_name;
EXCEPTION
    WHEN unique_violation THEN
        RETURN QUERY
        SELECT NULL::INTEGER, NULL::VARCHAR(100);
END;
$$ LANGUAGE plpgsql;

-- Процедура обновления исполнителя
CREATE OR REPLACE FUNCTION update_artist(p_artist_id INTEGER, p_name VARCHAR(100))
RETURNS TABLE(success BOOLEAN) AS $$
BEGIN
    UPDATE artists
    SET name = p_name
    WHERE artist_id = p_artist_id;
    
    IF FOUND THEN
        RETURN QUERY SELECT true::BOOLEAN;
    ELSE
        RETURN QUERY SELECT false::BOOLEAN;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Процедура удаления исполнителя
CREATE OR REPLACE FUNCTION delete_artist(p_artist_id INTEGER)
RETURNS TABLE(success BOOLEAN) AS $$
DECLARE
    tracks_count INTEGER;
BEGIN
    -- Проверяем, используются ли треки этого исполнителя
    SELECT COUNT(*) INTO tracks_count
    FROM tracks
    WHERE artist_id = p_artist_id;
    
    IF tracks_count > 0 THEN
        -- Не позволяем удалить исполнителя, если у него есть треки
        RETURN QUERY SELECT false::BOOLEAN;
    ELSE
        DELETE FROM artists
        WHERE artist_id = p_artist_id;
        
        IF FOUND THEN
            RETURN QUERY SELECT true::BOOLEAN;
        ELSE
            RETURN QUERY SELECT false::BOOLEAN;
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Процедура добавления трека
CREATE OR REPLACE FUNCTION add_track(
    p_user_id INTEGER,
    p_title VARCHAR(255),
    p_artist_id INTEGER,
    p_genre_id INTEGER,
    p_bpm INTEGER,
    p_duration_sec INTEGER
)
RETURNS TABLE(track_id INTEGER, title VARCHAR(255), created_at TIMESTAMP) AS $$
DECLARE
    new_track_id INTEGER;
BEGIN
    INSERT INTO tracks (user_id, title, artist_id, genre_id, bpm, duration_sec)
    VALUES (p_user_id, p_title, p_artist_id, p_genre_id, p_bpm, p_duration_sec)
    RETURNING track_id INTO new_track_id;
    
    RETURN QUERY
    SELECT new_track_id, p_title, CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Процедура обновления трека
CREATE OR REPLACE FUNCTION update_track(
    p_track_id INTEGER,
    p_title VARCHAR(255),
    p_artist_id INTEGER,
    p_genre_id INTEGER,
    p_bpm INTEGER,
    p_duration_sec INTEGER
)
RETURNS TABLE(success BOOLEAN) AS $$
BEGIN
    UPDATE tracks
    SET title = p_title,
        artist_id = p_artist_id,
        genre_id = p_genre_id,
        bpm = p_bpm,
        duration_sec = p_duration_sec
    WHERE track_id = p_track_id;
    
    IF FOUND THEN
        RETURN QUERY SELECT true::BOOLEAN;
    ELSE
        RETURN QUERY SELECT false::BOOLEAN;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Процедура удаления трека
CREATE OR REPLACE FUNCTION delete_track(p_track_id INTEGER)
RETURNS TABLE(success BOOLEAN) AS $$
BEGIN
    DELETE FROM tracks
    WHERE track_id = p_track_id;
    
    IF FOUND THEN
        RETURN QUERY SELECT true::BOOLEAN;
    ELSE
        RETURN QUERY SELECT false::BOOLEAN;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Процедура получения треков пользователя
CREATE OR REPLACE FUNCTION get_user_tracks(p_user_id INTEGER)
RETURNS TABLE(
    track_id INTEGER,
    title VARCHAR(255),
    artist_name VARCHAR(100),
    genre_name VARCHAR(100),
    bpm INTEGER,
    duration_sec INTEGER,
    created_at TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT t.track_id, t.title, a.name, g.name, t.bpm, t.duration_sec, t.created_at
    FROM tracks t
    JOIN artists a ON t.artist_id = a.artist_id
    JOIN genres g ON t.genre_id = g.genre_id
    WHERE t.user_id = p_user_id
    ORDER BY t.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Процедура получения всех треков (для администраторов)
CREATE OR REPLACE FUNCTION get_all_tracks_admin()
RETURNS TABLE(
    track_id INTEGER,
    title VARCHAR(255),
    artist_name VARCHAR(100),
    genre_name VARCHAR(100),
    bpm INTEGER,
    duration_sec INTEGER,
    created_at TIMESTAMP,
    user_login VARCHAR(50)
) AS $$
BEGIN
    RETURN QUERY
    SELECT t.track_id, t.title, a.name, g.name, t.bpm, t.duration_sec, t.created_at, u.login
    FROM tracks t
    JOIN artists a ON t.artist_id = a.artist_id
    JOIN genres g ON t.genre_id = g.genre_id
    JOIN "user" u ON t.user_id = u.user_id
    ORDER BY t.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Процедура создания коллекции
CREATE OR REPLACE FUNCTION create_collection(
    p_user_id INTEGER,
    p_name VARCHAR(255),
    p_is_favorite BOOLEAN
)
RETURNS TABLE(collection_id INTEGER, name VARCHAR(255), is_favorite BOOLEAN, created_at TIMESTAMP) AS $$
DECLARE
    new_collection_id INTEGER;
BEGIN
    INSERT INTO collections (user_id, name, is_favorite)
    VALUES (p_user_id, p_name, p_is_favorite)
    RETURNING collection_id INTO new_collection_id;
    
    RETURN QUERY
    SELECT new_collection_id, p_name, p_is_favorite, CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Процедура обновления коллекции
CREATE OR REPLACE FUNCTION update_collection(
    p_collection_id INTEGER,
    p_name VARCHAR(255),
    p_is_favorite BOOLEAN
)
RETURNS TABLE(success BOOLEAN) AS $$
BEGIN
    UPDATE collections
    SET name = p_name,
        is_favorite = p_is_favorite
    WHERE collection_id = p_collection_id;
    
    IF FOUND THEN
        RETURN QUERY SELECT true::BOOLEAN;
    ELSE
        RETURN QUERY SELECT false::BOOLEAN;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Процедура удаления коллекции
CREATE OR REPLACE FUNCTION delete_collection(p_collection_id INTEGER)
RETURNS TABLE(success BOOLEAN) AS $$
BEGIN
    DELETE FROM collections
    WHERE collection_id = p_collection_id;
    
    IF FOUND THEN
        RETURN QUERY SELECT true::BOOLEAN;
    ELSE
        RETURN QUERY SELECT false::BOOLEAN;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Процедура получения коллекций пользователя
CREATE OR REPLACE FUNCTION get_user_collections(p_user_id INTEGER)
RETURNS TABLE(
    collection_id INTEGER,
    name VARCHAR(255),
    is_favorite BOOLEAN,
    created_at TIMESTAMP,
    tracks_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT c.collection_id, c.name, c.is_favorite, c.created_at,
           (SELECT COUNT(*) FROM collection_tracks ct WHERE ct.collection_id = c.collection_id) AS tracks_count
    FROM collections c
    WHERE c.user_id = p_user_id
    ORDER BY c.is_favorite DESC, c.name;
END;
$$ LANGUAGE plpgsql;

-- Процедура добавления трека в коллекцию
CREATE OR REPLACE FUNCTION add_track_to_collection(
    p_collection_id INTEGER,
    p_track_id INTEGER
)
RETURNS TABLE(success BOOLEAN) AS $$
BEGIN
    INSERT INTO collection_tracks (collection_id, track_id)
    VALUES (p_collection_id, p_track_id);
    
    IF FOUND THEN
        RETURN QUERY SELECT true::BOOLEAN;
    ELSE
        RETURN QUERY SELECT false::BOOLEAN;
    END IF;
EXCEPTION
    WHEN unique_violation THEN
        RETURN QUERY SELECT true::BOOLEAN; -- Уже добавлено
END;
$$ LANGUAGE plpgsql;

-- Процедура удаления трека из коллекции
CREATE OR REPLACE FUNCTION remove_track_from_collection(
    p_collection_id INTEGER,
    p_track_id INTEGER
)
RETURNS TABLE(success BOOLEAN) AS $$
BEGIN
    DELETE FROM collection_tracks
    WHERE collection_id = p_collection_id AND track_id = p_track_id;
    
    IF FOUND THEN
        RETURN QUERY SELECT true::BOOLEAN;
    ELSE
        RETURN QUERY SELECT false::BOOLEAN;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Процедура поиска треков
CREATE OR REPLACE FUNCTION search_tracks(
    p_title VARCHAR(255),
    p_artist VARCHAR(100),
    p_genre_id INTEGER,
    p_bpm INTEGER,
    p_duration INTEGER
)
RETURNS TABLE(
    track_id INTEGER,
    title VARCHAR(255),
    artist_name VARCHAR(100),
    genre_name VARCHAR(100),
    bpm INTEGER,
    duration_sec INTEGER,
    created_at TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT t.track_id, t.title, a.name, g.name, t.bpm, t.duration_sec, t.created_at
    FROM tracks t
    JOIN artists a ON t.artist_id = a.artist_id
    JOIN genres g ON t.genre_id = g.genre_id
    WHERE (p_title IS NULL OR t.title ILIKE '%' || p_title || '%')
      AND (p_artist IS NULL OR a.name ILIKE '%' || p_artist || '%')
      AND (p_genre_id IS NULL OR t.genre_id = p_genre_id)
      AND (p_bpm IS NULL OR t.bpm = p_bpm)
      AND (p_duration IS NULL OR t.duration_sec = p_duration)
    ORDER BY t.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Процедура получения всех пользователей (для администраторов)
CREATE OR REPLACE FUNCTION get_all_users_admin()
RETURNS TABLE(
    user_id INTEGER,
    login VARCHAR(50),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    email VARCHAR(100),
    is_admin BOOLEAN,
    is_active BOOLEAN,
    created_at TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT u.user_id, u.login, u.first_name, u.last_name, u.email, u.is_admin, u.is_active, u.created_at
    FROM "user" u
    ORDER BY u.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Процедура получения журнала аудита
CREATE OR REPLACE FUNCTION get_audit_log()
RETURNS TABLE(
    log_id INTEGER,
    user_login VARCHAR(50),
    operation_type VARCHAR(20),
    table_name VARCHAR(50),
    record_id INTEGER,
    operation_time TIMESTAMP,
    details JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT al.log_id, u.login, al.operation_type, al.table_name, al.record_id, al.operation_time, al.details
    FROM audit_log al
    LEFT JOIN "user" u ON al.user_id = u.user_id
    ORDER BY al.operation_time DESC;
END;
$$ LANGUAGE plpgsql;

-- Вставка начальных данных
INSERT INTO genres (name) VALUES 
    ('Рок'), 
    ('Поп'), 
    ('Джаз'), 
    ('Хип-хоп'), 
    ('Электроника'), 
    ('Классика')
ON CONFLICT (name) DO NOTHING;

INSERT INTO artists (name) VALUES 
    ('The Beatles'), 
    ('Michael Jackson'), 
    ('Eminem'), 
    ('Queen'), 
    ('Miles Davis')
ON CONFLICT (name) DO NOTHING;

-- Создание администратора по умолчанию
INSERT INTO "user" (login, password_hash, first_name, last_name, email, is_admin, is_active)
VALUES (
    'admin',
    pgp_sym_encrypt('admin', 'music_library_key'),
    'System',
    'Administrator',
    'admin@example.com',
    true,
    true
)
ON CONFLICT (login) DO NOTHING;

INSERT INTO "user" (login, password_hash, first_name, last_name, email, is_admin, is_active)
VALUES (
    'user',
    pgp_sym_encrypt('user', 'music_library_key'),
    'Regular',
    'User',
    'user@example.com',
    false,
    true
)
ON CONFLICT (login) DO NOTHING;