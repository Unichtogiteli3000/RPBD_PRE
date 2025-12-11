// Глобальные переменные
let currentUser = null;
let isAdmin = false;
let allGenres = [];
let userArtists = [];

// Базовый URL для API
const API_BASE_URL = '/api';

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

// Инициализация приложения
function initializeApp() {
    // Проверка сессии пользователя
    checkUserSession();
    
    // Настройка обработчиков событий
    setupEventListeners();
    
    // Загрузка начальных данных
    loadInitialData();
}

// Обработка входа
document.getElementById('login-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const login = document.getElementById('login').value;
  const password = document.getElementById(' password').value;

  try {
    const res = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login, password })
    });

    const data = await res.json();

    if (res.ok) {
      // Сохраняем токен и данные пользователя
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      window.location.href = 'index.html'; // Переход в личный кабинет
    } else {
      alert(data.message || 'Ошибка входа');
    }
  } catch (err) {
    console.error(err);
    alert('Ошибка подключения к серверу');
  }
});

// Проверка сессии пользователя
function checkUserSession() {
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user'));

  if (token && user) {
    currentUser = user;
    isAdmin = user.is_admin;
    updateUserInfo();
    toggleAdminPanel();
  } else {
    // Нет сессии → редирект на логин
    window.location.href = 'login.html';
  }
}

// Обновление информации о пользователе в интерфейсе
function updateUserInfo() {
    if (currentUser) {
        document.getElementById('username').textContent = `${currentUser.first_name || currentUser.login} ${currentUser.last_name || ''}`.trim();
        document.getElementById('avatar-img').src = currentUser.avatar_url || 'https://via.placeholder.com/150';
        document.getElementById('first-name').value = currentUser.first_name || '';
        document.getElementById('last-name').value = currentUser.last_name || '';
        document.getElementById('email').value = currentUser.email || '';
    }
}

// Переключение видимости админ-панели
function toggleAdminPanel() {
    const adminBtn = document.getElementById('admin-btn');
    if (isAdmin) {
        adminBtn.style.display = 'block';
    } else {
        adminBtn.style.display = 'none';
        // Убедимся, что админ-секция неактивна
        document.getElementById('admin-section').classList.remove('active');
    }
}

// Показать модальное окно добавления автора
function showAddArtistModal() {
    const modalBody = document.getElementById('modal-body');
    modalBody.innerHTML = `
        <form id="artist-form">
            <div class="form-group">
                <label for="artist-name">Имя исполнителя:</label>
                <input type="text" id="artist-name" required>
            </div>
            <div class="form-group">
                <button type="submit" class="btn btn-primary">Сохранить</button>
                <button type="button" class="btn btn-secondary" onclick="closeModal()">Отмена</button>
            </div>
        </form>
    `;
    document.getElementById('modal-title').textContent = 'Добавить автора';
    document.getElementById('artist-form').addEventListener('submit', saveArtist);
    showModal();
}

// Показать модальное окно редактирования автора
function showEditArtistModal(artistId) {
    const artist = userArtists.find(a => a.artist_id === artistId);
    if (!artist) return;

    const modalBody = document.getElementById('modal-body');
    modalBody.innerHTML = `
        <form id="artist-form">
            <input type="hidden" id="artist-id" value="${artist.artist_id}">
            <div class="form-group">
                <label for="artist-name">Имя исполнителя:</label>
                <input type="text" id="artist-name" value="${artist.name}" required>
            </div>
            <div class="form-group">
                <button type="submit" class="btn btn-primary">Сохранить</button>
                <button type="button" class="btn btn-secondary" onclick="closeModal()">Отмена</button>
            </div>
        </form>
    `;
    document.getElementById('modal-title').textContent = 'Редактировать автора';
    document.getElementById('artist-form').addEventListener('submit', saveArtist);
    showModal();
}

// Сохранение автора
function saveArtist(e) {
    e.preventDefault();
    const name = document.getElementById('artist-name').value.trim();
    if (!name) return;

    const artistId = document.getElementById('artist-id')?.value;
    const token = localStorage.getItem('auth_token');

    if (artistId) {
        // Редактирование
        fetch(`${API_BASE_URL}/artists/${artistId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name: name })
        })
        .then(response => response.json())
        .then(data => {
            if (data.message) {
                closeModal();
                loadUserArtists(); // Обновить таблицу
                showMessage('Исполнитель успешно обновлен!', 'success');
            } else {
                showMessage('Ошибка при обновлении исполнителя', 'error');
            }
        })
        .catch(error => {
            console.error('Ошибка:', error);
            showMessage('Ошибка при обновлении исполнителя', 'error');
        });
    } else {
        // Добавление
        fetch(`${API_BASE_URL}/artists`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name: name })
        })
        .then(response => response.json())
        .then(data => {
            if (data.artist_id) {
                closeModal();
                loadUserArtists(); // Обновить таблицу
                showMessage('Исполнитель успешно добавлен!', 'success');
            } else {
                showMessage('Ошибка при добавлении исполнителя', 'error');
            }
        })
        .catch(error => {
            console.error('Ошибка:', error);
            showMessage('Ошибка при добавлении исполнителя', 'error');
        });
    }
}

// Удаление автора
function deleteArtist(artistId) {
    if (!confirm('Удалить этого автора? Это может повлиять на треки!')) return;

    const token = localStorage.getItem('auth_token');

    fetch(`${API_BASE_URL}/artists/${artistId}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.message) {
            loadUserArtists(); // Обновить таблицу
            showMessage('Исполнитель успешно удален!', 'success');
        } else {
            showMessage('Ошибка при удалении исполнителя', 'error');
        }
    })
    .catch(error => {
        console.error('Ошибка:', error);
        showMessage('Ошибка при удалении исполнителя', 'error');
    });
}

// Настройка обработчиков событий
function setupEventListeners() {
    // Навигация
    document.getElementById('profile-btn').addEventListener('click', () => showSection('profile-section'));
    document.getElementById('tracks-btn').addEventListener('click', () => showSection('tracks-section'));
    document.getElementById('collections-btn').addEventListener('click', () => showSection('collections-section'));
    document.getElementById('search-btn').addEventListener('click', () => showSection('search-section'));
    document.getElementById('admin-btn').addEventListener('click', () => showSection('admin-section'));
    document.getElementById('artists-btn').addEventListener('click', () => showSection('artists-section'));

    // Выход
    document.getElementById('logout-btn').addEventListener('click', logout);
    
    // Профиль
    document.getElementById('profile-form').addEventListener('submit', saveProfile);
    document.getElementById('change-avatar-btn').addEventListener('click', changeAvatar);
    
    // Треки
    document.getElementById('add-track-btn').addEventListener('click', showAddTrackModal);
    
    // Авторы
    document.getElementById('add-artist-btn').addEventListener('click', showAddArtistModal);

    // Коллекции
    document.getElementById('add-collection-btn').addEventListener('click', showAddCollectionModal);
    
    // Поиск
    document.getElementById('search-submit-btn').addEventListener('click', performSearch);
    document.getElementById('search-reset-btn').addEventListener('click', resetSearch);
    
    // Админ-панель
    document.getElementById('admin-users-tab').addEventListener('click', () => switchAdminTab('users'));
    document.getElementById('admin-tracks-tab').addEventListener('click', () => switchAdminTab('tracks'));
    document.getElementById('admin-audit-tab').addEventListener('click', () => switchAdminTab('audit'));
    
    // Модальные окна
    document.getElementById('close-modal-btn').addEventListener('click', closeModal);
    document.getElementById('modal-overlay').addEventListener('click', function(e) {
        if (e.target === this) {
            closeModal();
        }
    });
}

// Показать определенную секцию
function showSection(sectionId) {
    // Скрыть все секции
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Убрать активный класс с кнопок навигации
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Показать выбранную секцию
    document.getElementById(sectionId).classList.add('active');
    
    // Добавить активный класс к соответствующей кнопке
    const activeBtnId = sectionId.replace('-section', '-btn');
    document.getElementById(activeBtnId).classList.add('active');
    
    // Загрузить данные для секции, если нужно
    switch(sectionId) {
        case 'tracks-section':
            loadUserTracks();
            break;
        case 'collections-section':
            loadUserCollections();
            break;
        case 'search-section':
            loadGenresForSearch();
            break;
        case 'artists-section':
            loadUserArtists();
            break;
        case 'admin-section':
            if (isAdmin) {
                loadAdminUsers(); // Загрузка пользователей по умолчанию
            }
            break;
    }
}

// Загрузка начальных данных
function loadInitialData() {
    loadGenres();
    loadUserArtists();
}

// Загрузка жанров
function loadGenres() {
    const token = localStorage.getItem('auth_token');
    
    fetch(`${API_BASE_URL}/genres`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then(data => {
        allGenres = data;
    })
    .catch(error => {
        console.error('Ошибка при загрузке жанров:', error);
    });
}

// Загрузка авторов пользователя
function loadUserArtists() {
    const token = localStorage.getItem('auth_token');
    
    fetch(`${API_BASE_URL}/artists`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then(data => {
        userArtists = data;
        displayArtists(userArtists);
    })
    .catch(error => {
        console.error('Ошибка при загрузке авторов:', error);
    });
}

//отображение авторов
function displayArtists(artists) {
    const tbody = document.getElementById('artists-tbody');
    tbody.innerHTML = '';
    artists.forEach(artist => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${artist.name}</td>
            <td>
                <button class="btn btn-secondary" onclick="showEditArtistModal(${artist.artist_id})">Редактировать</button>
                <button class="btn btn-danger" onclick="deleteArtist(${artist.artist_id})">Удалить</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Загрузка жанров для поиска
function loadGenresForSearch() {
    const genreSelect = document.getElementById('search-genre');
    genreSelect.innerHTML = '<option value="">Все жанры</option>';
    
    allGenres.forEach(genre => {
        const option = document.createElement('option');
        option.value = genre.genre_id;
        option.textContent = genre.name;
        genreSelect.appendChild(option);
    });
}

// Выход из системы
function logout() {
    // Очистить токен
    localStorage.removeItem('auth_token');
    currentUser = null;
    isAdmin = false;
    
    // Перенаправление на страницу входа
    window.location.href = 'login-page';
}

// Сохранение профиля
function saveProfile(e) {
    e.preventDefault();
    
    const profileData = {
        first_name: document.getElementById('first-name').value,
        last_name: document.getElementById('last-name').value,
        email: document.getElementById('email').value
    };
    
    const token = localStorage.getItem('auth_token');
    
    fetch(`${API_BASE_URL}/profile`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(profileData)
    })
    .then(response => response.json())
    .then(data => {
        if (data.message) {
            // Обновляем информацию о пользователе
            currentUser.first_name = profileData.first_name;
            currentUser.last_name = profileData.last_name;
            currentUser.email = profileData.email;
            updateUserInfo();
            showMessage('Профиль успешно сохранен!', 'success');
        } else {
            showMessage('Ошибка при сохранении профиля', 'error');
        }
    })
    .catch(error => {
        console.error('Ошибка:', error);
        showMessage('Ошибка при сохранении профиля', 'error');
    });
}

// Смена аватара
function changeAvatar() {
    // В реальной реализации будет открытие диалога загрузки файла
    alert('Функция смены аватара будет реализована позже');
}

// Загрузка треков пользователя
function loadUserTracks() {
    const token = localStorage.getItem('auth_token');
    
    fetch(`${API_BASE_URL}/tracks`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then(data => {
        displayTracks(data);
    })
    .catch(error => {
        console.error('Ошибка при загрузке треков:', error);
    });
}

// Отображение треков в таблице
function displayTracks(tracks) {
    const tbody = document.getElementById('tracks-tbody');
    tbody.innerHTML = '';
    
    tracks.forEach(track => {
        const row = document.createElement('tr');
        
        // Преобразование секунд в формат MM:SS
        const durationFormatted = formatDuration(track.duration_sec);
        
        row.innerHTML = `
            <td>${track.title}</td>
            <td>${track.artist_name}</td>
            <td>${track.genre_name}</td>
            <td>${track.bpm || 'N/A'}</td>
            <td>${durationFormatted}</td>
            <td>${track.created_at}</td>
            <td>
                <button class="btn btn-secondary" onclick="showEditTrackModal(${track.track_id})">Редактировать</button>
                <button class="btn btn-danger" onclick="deleteTrack(${track.track_id})">Удалить</button>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

// Форматирование длительности (секунды в MM:SS)
function formatDuration(seconds) {
    if (!seconds) return 'N/A';
    
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

// Показать модальное окно добавления трека
function showAddTrackModal() {
    const modalBody = document.getElementById('modal-body');
    modalBody.innerHTML = `
        <form id="track-form">
            <div class="form-group">
                <label for="track-title">Название:</label>
                <input type="text" id="track-title" required>
            </div>
            <div class="form-group">
                <label for="track-artist">Исполнитель:</label>
                <select id="track-artist" required>
                    <option value="">Выберите исполнителя</option>
                    ${userArtists.map(artist => `<option value="${artist.artist_id}">${artist.name}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label for="track-genre">Жанр:</label>
                <select id="track-genre" required>
                    <option value="">Выберите жанр</option>
                    ${allGenres.map(genre => `<option value="${genre.genre_id}">${genre.name}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label for="track-bpm">BPM:</label>
                <input type="number" id="track-bpm" min="0">
            </div>
            <div class="form-group">
                <label for="track-duration">Длительность (сек):</label>
                <input type="number" id="track-duration" min="0">
            </div>
            <div class="form-group">
                <button type="submit" class="btn btn-primary">Сохранить</button>
                <button type="button" class="btn btn-secondary" onclick="closeModal()">Отмена</button>
            </div>
        </form>
    `;
    
    document.getElementById('modal-title').textContent = 'Добавить трек';
    document.getElementById('track-form').addEventListener('submit', saveTrack);
    
    showModal();
}

// Показать модальное окно редактирования трека
function showEditTrackModal(trackId) {
    const token = localStorage.getItem('auth_token');
    
    // Загружаем данные трека
    fetch(`${API_BASE_URL}/tracks/${trackId}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then(track => {
        const modalBody = document.getElementById('modal-body');
        modalBody.innerHTML = `
            <form id="track-form">
                <input type="hidden" id="track-id" value="${track.track_id}">
                <div class="form-group">
                    <label for="track-title">Название:</label>
                    <input type="text" id="track-title" value="${track.title}" required>
                </div>
                <div class="form-group">
                    <label for="track-artist">Исполнитель:</label>
                    <select id="track-artist" required>
                        <option value="">Выберите исполнителя</option>
                        ${userArtists.map(artist => 
                            `<option value="${artist.artist_id}" ${artist.artist_id === track.artist_id ? 'selected' : ''}>${artist.name}</option>`
                        ).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label for="track-genre">Жанр:</label>
                    <select id="track-genre" required>
                        <option value="">Выберите жанр</option>
                        ${allGenres.map(genre => 
                            `<option value="${genre.genre_id}" ${genre.genre_id === track.genre_id ? 'selected' : ''}>${genre.name}</option>`
                        ).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label for="track-bpm">BPM:</label>
                    <input type="number" id="track-bpm" value="${track.bpm || ''}" min="0">
                </div>
                <div class="form-group">
                    <label for="track-duration">Длительность (сек):</label>
                    <input type="number" id="track-duration" value="${track.duration_sec || ''}" min="0">
                </div>
                <div class="form-group">
                    <button type="submit" class="btn btn-primary">Сохранить</button>
                    <button type="button" class="btn btn-secondary" onclick="closeModal()">Отмена</button>
                </div>
            </form>
        `;
        
        document.getElementById('modal-title').textContent = 'Редактировать трек';
        document.getElementById('track-form').addEventListener('submit', saveTrack);
        
        showModal();
    })
    .catch(error => {
        console.error('Ошибка при загрузке трека:', error);
        showMessage('Ошибка при загрузке данных трека', 'error');
    });
}

// Сохранение трека
function saveTrack(e) {
    e.preventDefault();
    
    const trackData = {
        title: document.getElementById('track-title').value,
        artist_id: parseInt(document.getElementById('track-artist').value),
        genre_id: parseInt(document.getElementById('track-genre').value),
        bpm: parseInt(document.getElementById('track-bpm').value) || null,
        duration_sec: parseInt(document.getElementById('track-duration').value) || null
    };
    
    const trackId = document.getElementById('track-id') ? parseInt(document.getElementById('track-id').value) : null;
    const token = localStorage.getItem('auth_token');
    
    let url, method;
    if (trackId) {
        // Редактирование
        url = `${API_BASE_URL}/tracks/${trackId}`;
        method = 'PUT';
    } else {
        // Добавление
        url = `${API_BASE_URL}/tracks`;
        method = 'POST';
    }
    
    fetch(url, {
        method: method,
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(trackData)
    })
    .then(response => response.json())
    .then(data => {
        if (data.track_id || data.message) {
            closeModal();
            loadUserTracks(); // Обновить список треков
            showMessage(trackId ? 'Трек успешно обновлен!' : 'Трек успешно добавлен!', 'success');
        } else {
            showMessage('Ошибка при сохранении трека', 'error');
        }
    })
    .catch(error => {
        console.error('Ошибка:', error);
        showMessage('Ошибка при сохранении трека', 'error');
    });
}

// Удаление трека
function deleteTrack(trackId) {
    if (confirm('Вы уверены, что хотите удалить этот трек?')) {
        const token = localStorage.getItem('auth_token');
        
        fetch(`${API_BASE_URL}/tracks/${trackId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.message) {
                loadUserTracks(); // Обновить список треков
                showMessage('Трек успешно удален!', 'success');
            } else {
                showMessage('Ошибка при удалении трека', 'error');
            }
        })
        .catch(error => {
            console.error('Ошибка:', error);
            showMessage('Ошибка при удалении трека', 'error');
        });
    }
}

// Загрузка коллекций пользователя
function loadUserCollections() {
    const token = localStorage.getItem('auth_token');
    
    fetch(`${API_BASE_URL}/collections`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then(data => {
        displayCollections(data);
    })
    .catch(error => {
        console.error('Ошибка при загрузке коллекций:', error);
    });
}

// Отображение коллекций
function displayCollections(collections) {
    const container = document.getElementById('collections-container');
    container.innerHTML = '';
    
    collections.forEach(collection => {
        const collectionDiv = document.createElement('div');
        collectionDiv.className = 'collection-item';
        
        collectionDiv.innerHTML = `
            <div class="collection-header">
                <div class="collection-name">${collection.name} ${collection.is_favorite ? '❤️' : ''}</div>
                <div class="collection-info">Создано: ${collection.created_at}</div>
            </div>
            <div class="collection-controls">
                <button class="btn btn-secondary" onclick="showEditCollectionModal(${collection.collection_id})">Редактировать</button>
                <button class="btn btn-danger" onclick="deleteCollection(${collection.collection_id})">Удалить</button>
            </div>
            <div class="collection-tracks">
                <h4>Треки в коллекции:</h4>
                <ul>
                    ${collection.tracks ? collection.tracks.map(track => 
                        `<li>${track.title} - ${track.artist_name} 
                           <button class="btn btn-secondary btn-sm" onclick="removeTrackFromCollection(${collection.collection_id}, ${track.track_id})">Удалить</button>
                           </li>`
                    ).join('') : ''}
                </ul>
                <button class="btn btn-secondary" onclick="showAddTrackToCollectionModal(${collection.collection_id})">Добавить трек</button>
            </div>
        `;
        
        container.appendChild(collectionDiv);
    });
}

// Показать модальное окно добавления коллекции
function showAddCollectionModal() {
    const modalBody = document.getElementById('modal-body');
    modalBody.innerHTML = `
        <form id="collection-form">
            <div class="form-group">
                <label for="collection-name">Название коллекции:</label>
                <input type="text" id="collection-name" required>
            </div>
            <div class="form-group">
                <label>
                    <input type="checkbox" id="collection-favorite"> 
                    Сделать коллекцией "Любимые треки"
                </label>
            </div>
            <div class="form-group">
                <button type="submit" class="btn btn-primary">Создать</button>
                <button type="button" class="btn btn-secondary" onclick="closeModal()">Отмена</button>
            </div>
        </form>
    `;
    
    document.getElementById('modal-title').textContent = 'Создать коллекцию';
    document.getElementById('collection-form').addEventListener('submit', saveCollection);
    
    showModal();
}

// Сохранение коллекции
function saveCollection(e) {
    e.preventDefault();
    
    const collectionData = {
        name: document.getElementById('collection-name').value,
        is_favorite: document.getElementById('collection-favorite').checked
    };
    
    const token = localStorage.getItem('auth_token');
    
    fetch(`${API_BASE_URL}/collections`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(collectionData)
    })
    .then(response => response.json())
    .then(data => {
        if (data.collection_id) {
            closeModal();
            loadUserCollections(); // Обновить список коллекций
            showMessage('Коллекция успешно создана!', 'success');
        } else {
            showMessage('Ошибка при создании коллекции', 'error');
        }
    })
    .catch(error => {
        console.error('Ошибка:', error);
        showMessage('Ошибка при создании коллекции', 'error');
    });
}

// Показать модальное окно редактирования коллекции
function showEditCollectionModal(collectionId) {
    const token = localStorage.getItem('auth_token');
    
    // Сначала получаем данные коллекции
    fetch(`${API_BASE_URL}/collections/${collectionId}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then(collection => {
        const modalBody = document.getElementById('modal-body');
        modalBody.innerHTML = `
            <form id="collection-form">
                <input type="hidden" id="collection-id" value="${collection.collection_id}">
                <div class="form-group">
                    <label for="collection-name">Название коллекции:</label>
                    <input type="text" id="collection-name" value="${collection.name}" required>
                </div>
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="collection-favorite" ${collection.is_favorite ? 'checked' : ''}> 
                        Сделать коллекцией "Любимые треки"
                    </label>
                </div>
                <div class="form-group">
                    <button type="submit" class="btn btn-primary">Сохранить</button>
                    <button type="button" class="btn btn-secondary" onclick="closeModal()">Отмена</button>
                </div>
            </form>
        `;
        
        document.getElementById('modal-title').textContent = 'Редактировать коллекцию';
        document.getElementById('collection-form').addEventListener('submit', updateCollection);
        
        showModal();
    })
    .catch(error => {
        console.error('Ошибка:', error);
        showMessage('Ошибка при загрузке данных коллекции', 'error');
    });
}

// Обновление коллекции
function updateCollection(e) {
    e.preventDefault();
    
    const collectionId = parseInt(document.getElementById('collection-id').value);
    const collectionData = {
        name: document.getElementById('collection-name').value,
        is_favorite: document.getElementById('collection-favorite').checked
    };
    
    const token = localStorage.getItem('auth_token');
    
    fetch(`${API_BASE_URL}/collections/${collectionId}`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(collectionData)
    })
    .then(response => response.json())
    .then(data => {
        if (data.message) {
            closeModal();
            loadUserCollections(); // Обновить список коллекций
            showMessage('Коллекция успешно обновлена!', 'success');
        } else {
            showMessage('Ошибка при обновлении коллекции', 'error');
        }
    })
    .catch(error => {
        console.error('Ошибка:', error);
        showMessage('Ошибка при обновлении коллекции', 'error');
    });
}

// Удаление коллекции
function deleteCollection(collectionId) {
    if (confirm('Вы уверены, что хотите удалить эту коллекцию?')) {
        const token = localStorage.getItem('auth_token');
        
        fetch(`${API_BASE_URL}/collections/${collectionId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.message) {
                loadUserCollections(); // Обновить список коллекций
                showMessage('Коллекция успешно удалена!', 'success');
            } else {
                showMessage('Ошибка при удалении коллекции', 'error');
            }
        })
        .catch(error => {
            console.error('Ошибка:', error);
            showMessage('Ошибка при удалении коллекции', 'error');
        });
    }
}

// Выполнение поиска
function performSearch() {
    const title = document.getElementById('search-title').value;
    const artist = document.getElementById('search-artist').value;
    const genreId = document.getElementById('search-genre').value;
    const bpm = document.getElementById('search-bpm').value;
    const duration = document.getElementById('search-duration').value;
    
    const token = localStorage.getItem('auth_token');
    
    // Формируем URL с параметрами
    let url = `${API_BASE_URL}/search/tracks?`;
    const params = [];
    if (title) params.push(`title=${encodeURIComponent(title)}`);
    if (artist) params.push(`artist=${encodeURIComponent(artist)}`);
    if (genreId) params.push(`genre_id=${encodeURIComponent(genreId)}`);
    if (bpm) params.push(`bpm=${encodeURIComponent(bpm)}`);
    if (duration) params.push(`duration=${encodeURIComponent(duration)}`);
    
    url += params.join('&');
    
    fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then(data => {
        displaySearchResults(data);
    })
    .catch(error => {
        console.error('Ошибка при поиске:', error);
        showMessage('Ошибка при выполнении поиска', 'error');
    });
}

// Отображение результатов поиска
function displaySearchResults(results) {
    const tbody = document.getElementById('search-results-tbody');
    tbody.innerHTML = '';
    
    results.forEach(track => {
        const durationFormatted = formatDuration(track.duration_sec);
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${track.title}</td>
            <td>${track.artist_name}</td>
            <td>${track.genre_name}</td>
            <td>${track.bpm || 'N/A'}</td>
            <td>${durationFormatted}</td>
            <td>${track.created_at}</td>
            <td>
                <button class="btn btn-secondary" onclick="addToCollection(${track.track_id})">В коллекцию</button>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

// Сброс поиска
function resetSearch() {
    document.getElementById('search-title').value = '';
    document.getElementById('search-artist').value = '';
    document.getElementById('search-genre').value = '';
    document.getElementById('search-bpm').value = '';
    document.getElementById('search-duration').value = '';
    
    document.getElementById('search-results-tbody').innerHTML = '';
}

// Добавление трека в коллекцию
function addToCollection(trackId) {
    // Показываем модальное окно с выбором коллекции
    const token = localStorage.getItem('auth_token');
    
    // Получаем список коллекций пользователя
    fetch(`${API_BASE_URL}/collections`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then(collections => {
        const modalBody = document.getElementById('modal-body');
        modalBody.innerHTML = `
            <div>
                <h4>Выберите коллекцию:</h4>
                ${collections.map(collection => `
                    <div class="collection-option">
                        <button class="btn btn-secondary" onclick="addTrackToCollection(${collection.collection_id}, ${trackId})">
                            ${collection.name}
                        </button>
                    </div>
                `).join('')}
                <div class="form-group" style="margin-top: 15px;">
                    <button class="btn btn-secondary" onclick="closeModal()">Отмена</button>
                </div>
            </div>
        `;
        
        document.getElementById('modal-title').textContent = 'Добавить трек в коллекцию';
        showModal();
    })
    .catch(error => {
        console.error('Ошибка:', error);
        showMessage('Ошибка при загрузке коллекций', 'error');
    });
}

// Добавление трека в коллекцию
function addTrackToCollection(collectionId, trackId) {
    const token = localStorage.getItem('auth_token');
    
    fetch(`${API_BASE_URL}/collections/${collectionId}/tracks`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ track_id: trackId })
    })
    .then(response => response.json())
    .then(data => {
        if (data.message) {
            closeModal();
            showMessage('Трек успешно добавлен в коллекцию!', 'success');
            // Обновляем коллекции, если находимся на соответствующей вкладке
            if (document.getElementById('collections-section').classList.contains('active')) {
                loadUserCollections();
            }
        } else {
            showMessage('Ошибка при добавлении трека в коллекцию', 'error');
        }
    })
    .catch(error => {
        console.error('Ошибка:', error);
        showMessage('Ошибка при добавлении трека в коллекцию', 'error');
    });
}

// Показать модальное окно добавления трека в коллекцию
function showAddTrackToCollectionModal(collectionId) {
    const token = localStorage.getItem('auth_token');
    
    // Получаем список треков пользователя
    fetch(`${API_BASE_URL}/tracks`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then(tracks => {
        const modalBody = document.getElementById('modal-body');
        modalBody.innerHTML = `
            <div>
                <h4>Выберите трек для добавления:</h4>
                ${tracks.map(track => `
                    <div class="track-option">
                        <button class="btn btn-secondary" onclick="addTrackToCollection(${collectionId}, ${track.track_id})" style="margin: 5px 0; display: block; width: 100%;">
                            ${track.title} - ${track.artist_name}
                        </button>
                    </div>
                `).join('')}
                <div class="form-group" style="margin-top: 15px;">
                    <button class="btn btn-secondary" onclick="closeModal()">Отмена</button>
                </div>
            </div>
        `;
        
        document.getElementById('modal-title').textContent = 'Добавить трек в коллекцию';
        showModal();
    })
    .catch(error => {
        console.error('Ошибка:', error);
        showMessage('Ошибка при загрузке треков', 'error');
    });
}

// Удаление трека из коллекции
function removeTrackFromCollection(collectionId, trackId) {
    if (confirm('Вы уверены, что хотите удалить этот трек из коллекции?')) {
        const token = localStorage.getItem('auth_token');
        
        fetch(`${API_BASE_URL}/collections/${collectionId}/tracks/${trackId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.message) {
                loadUserCollections(); // Обновить список коллекций
                showMessage('Трек успешно удален из коллекции!', 'success');
            } else {
                showMessage('Ошибка при удалении трека из коллекции', 'error');
            }
        })
        .catch(error => {
            console.error('Ошибка:', error);
            showMessage('Ошибка при удалении трека из коллекции', 'error');
        });
    }
}

// Переключение вкладок админ-панели
function switchAdminTab(tabName) {
    // Снять активный класс со всех кнопок
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Добавить активный класс к нажатой кнопке
    event.target.classList.add('active');
    
    const token = localStorage.getItem('auth_token');
    const adminContent = document.querySelector('.admin-content');
    
    switch(tabName) {
        case 'users':
            fetch(`${API_BASE_URL}/admin/users`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            })
            .then(response => response.json())
            .then(data => {
                adminContent.innerHTML = `
                    <h3>Список пользователей</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Логин</th>
                                <th>Имя</th>
                                <th>Фамилия</th>
                                <th>Email</th>
                                <th>Админ</th>
                                <th>Дата создания</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.map(user => `
                                <tr>
                                    <td>${user.user_id}</td>
                                    <td>${user.login}</td>
                                    <td>${user.first_name || ''}</td>
                                    <td>${user.last_name || ''}</td>
                                    <td>${user.email || ''}</td>
                                    <td>${user.is_admin ? 'Да' : 'Нет'}</td>
                                    <td>${user.created_at}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `;
            })
            .catch(error => {
                console.error('Ошибка:', error);
                adminContent.innerHTML = '<h3>Список пользователей</h3><p>Ошибка при загрузке пользователей</p>';
            });
            break;
        case 'tracks':
            fetch(`${API_BASE_URL}/admin/tracks`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            })
            .then(response => response.json())
            .then(data => {
                adminContent.innerHTML = `
                    <h3>Все треки</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Название</th>
                                <th>Исполнитель</th>
                                <th>Жанр</th>
                                <th>BPM</th>
                                <th>Длительность</th>
                                <th>Пользователь</th>
                                <th>Дата создания</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.map(track => `
                                <tr>
                                    <td>${track.track_id}</td>
                                    <td>${track.title}</td>
                                    <td>${track.artist_name}</td>
                                    <td>${track.genre_name}</td>
                                    <td>${track.bpm || ''}</td>
                                    <td>${track.duration_sec || ''}</td>
                                    <td>${track.user_login || track.user_id}</td>
                                    <td>${track.created_at}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `;
            })
            .catch(error => {
                console.error('Ошибка:', error);
                adminContent.innerHTML = '<h3>Все треки</h3><p>Ошибка при загрузке треков</p>';
            });
            break;
        case 'audit':
            fetch(`${API_BASE_URL}/admin/audit`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            })
            .then(response => response.json())
            .then(data => {
                adminContent.innerHTML = `
                    <h3>Журнал операций</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Пользователь</th>
                                <th>Тип операции</th>
                                <th>Таблица</th>
                                <th>ID записи</th>
                                <th>Время</th>
                                <th>Детали</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.map(entry => `
                                <tr>
                                    <td>${entry.log_id}</td>
                                    <td>${entry.user_login || entry.user_id}</td>
                                    <td>${entry.operation_type}</td>
                                    <td>${entry.table_name}</td>
                                    <td>${entry.record_id}</td>
                                    <td>${entry.operation_time}</td>
                                    <td>${entry.details ? JSON.stringify(entry.details) : ''}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `;
            })
            .catch(error => {
                console.error('Ошибка:', error);
                adminContent.innerHTML = '<h3>Журнал операций</h3><p>Ошибка при загрузке журнала</p>';
            });
            break;
    }
}

// Загрузка пользователей для админ-панели
function loadAdminUsers() {
    if (isAdmin) {
        switchAdminTab('users');
    }
}

// Показать модальное окно
function showModal() {
    document.getElementById('modal-overlay').style.display = 'flex';
}

// Закрыть модальное окно
function closeModal() {
    document.getElementById('modal-overlay').style.display = 'none';
}

// Показать сообщение пользователю
function showMessage(message, type) {
    // Создаем элемент сообщения
    const messageDiv = document.createElement('div');
    messageDiv.className = `message message-${type}`;
    messageDiv.textContent = message;
    
    // Добавляем в начало body
    document.body.appendChild(messageDiv);
    
    // Удаляем через 3 секунды
    setTimeout(() => {
        messageDiv.remove();
    }, 3000);
}