// Глобальные переменные
let currentUser = null;
let isAdmin = false;
let allGenres = [];
let userArtists = [];

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

// Проверка сессии пользователя
function checkUserSession() {
    // В реальной реализации здесь будет проверка сессии на сервере
    // Для демонстрации устанавливаем тестового пользователя
    currentUser = {
        user_id: 1,
        login: 'test_user',
        first_name: 'Иван',
        last_name: 'Петров',
        email: 'ivan@example.com',
        avatar_url: 'https://via.placeholder.com/150'
    };
    
    isAdmin = false; // В реальной системе это будет определяться по роли пользователя
    
    updateUserInfo();
    toggleAdminPanel();
}

// Обновление информации о пользователе в интерфейсе
function updateUserInfo() {
    if (currentUser) {
        document.getElementById('username').textContent = `${currentUser.first_name} ${currentUser.last_name}`;
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

    if (artistId) {
        // Редактирование
        const index = userArtists.findIndex(a => a.artist_id == artistId);
        if (index !== -1) {
            userArtists[index].name = name;
        }
    } else {
        // Добавление
        const newId = userArtists.length > 0 ? Math.max(...userArtists.map(a => a.artist_id)) + 1 : 1;
        userArtists.push({ artist_id: newId, name });
    }

    // Сохранить в localStorage
    localStorage.setItem('userArtists', JSON.stringify(userArtists));

    closeModal();
    loadUserArtists(); // Обновить таблицу
}

// Удаление автора
function deleteArtist(artistId) {
    if (!confirm('Удалить этого автора? Это может повлиять на треки!')) return;

    userArtists = userArtists.filter(a => a.artist_id !== artistId);
    localStorage.setItem('userArtists', JSON.stringify(userArtists));
    loadUserArtists();
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
    loadArtists();
}

// Загрузка жанров
function loadGenres() {
    // В реальной реализации будет вызов API
    // Для демонстрации используем тестовые данные
    allGenres = [
        { genre_id: 1, name: 'Рок' },
        { genre_id: 2, name: 'Поп' },
        { genre_id: 3, name: 'Джаз' },
        { genre_id: 4, name: 'Хип-хоп' },
        { genre_id: 5, name: 'Электроника' },
        { genre_id: 6, name: 'Классика' }
    ];
}


// Загрузка авторов пользователя
function loadUserArtists() {
    // В реальной реализации — вызов API
    // Для демо — сохраняем в памяти браузера или просто используем массив
    if (localStorage.getItem('userArtists')) {
        userArtists = JSON.parse(localStorage.getItem('userArtists'));
    } else {
        // Начальные данные (можно убрать после отладки)
        userArtists = [
            { artist_id: 1, name: 'The Beatles' },
            { artist_id: 2, name: 'Michael Jackson' },
            { artist_id: 3, name: 'Eminem' }
        ];
        localStorage.setItem('userArtists', JSON.stringify(userArtists));
    }
    displayArtists(userArtists);
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
    // В реальной реализации будет вызов API для завершения сессии
    currentUser = null;
    isAdmin = false;
    
    // Перенаправление на страницу входа или обновление страницы
    window.location.href = 'login.html'; // или просто window.location.reload();
}

// Сохранение профиля
function saveProfile(e) {
    e.preventDefault();
    
    const profileData = {
        user_id: currentUser.user_id,
        first_name: document.getElementById('first-name').value,
        last_name: document.getElementById('last-name').value,
        email: document.getElementById('email').value
    };
    
    // В реальной реализации будет вызов API
    // Для демонстрации просто обновим данные
    currentUser = { ...currentUser, ...profileData };
    updateUserInfo();
    
    // Показать сообщение об успехе
    alert('Профиль успешно сохранен!');
}

// Смена аватара
function changeAvatar() {
    // В реальной реализации будет открытие диалога загрузки файла
    alert('Функция смены аватара будет реализована позже');
}

// Загрузка треков пользователя
function loadUserTracks() {
    // В реальной реализации будет вызов API
    // Для демонстрации используем тестовые данные
    const tracks = [
        {
            track_id: 1,
            title: 'Bohemian Rhapsody',
            artist_name: 'Queen',
            genre_name: 'Рок',
            bpm: 70,
            duration_sec: 355,
            created_at: '2023-05-15 10:30:00'
        },
        {
            track_id: 2,
            title: 'Billie Jean',
            artist_name: 'Michael Jackson',
            genre_name: 'Поп',
            bpm: 117,
            duration_sec: 294,
            created_at: '2023-06-20 14:22:00'
        },
        {
            track_id: 3,
            title: 'So What',
            artist_name: 'Miles Davis',
            genre_name: 'Джаз',
            bpm: 68,
            duration_sec: 564,
            created_at: '2023-07-10 09:15:00'
        }
    ];
    
    displayTracks(tracks);
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
                    ${allArtists.map(artist => `<option value="${artist.artist_id}">${artist.name}</option>`).join('')}
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
    // В реальной реализации будет загрузка данных трека
    // Для демонстрации используем тестовые данные
    const track = {
        track_id: trackId,
        title: 'Название трека',
        artist_id: 1,
        genre_id: 1,
        bpm: 120,
        duration_sec: 180
    };
    
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
                    ${allArtists.map(artist => 
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
                <input type="number" id="track-bpm" value="${track.bpm}" min="0">
            </div>
            <div class="form-group">
                <label for="track-duration">Длительность (сек):</label>
                <input type="number" id="track-duration" value="${track.duration_sec}" min="0">
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
}

// Сохранение трека
function saveTrack(e) {
    e.preventDefault();
    
    const trackData = {
        track_id: document.getElementById('track-id') ? parseInt(document.getElementById('track-id').value) : null,
        title: document.getElementById('track-title').value,
        artist_id: parseInt(document.getElementById('track-artist').value),
        genre_id: parseInt(document.getElementById('track-genre').value),
        bpm: parseInt(document.getElementById('track-bpm').value) || null,
        duration_sec: parseInt(document.getElementById('track-duration').value) || null,
        user_id: currentUser.user_id
    };
    
    // В реальной реализации будет вызов API
    console.log('Сохранение трека:', trackData);
    
    closeModal();
    loadUserTracks(); // Обновить список треков
}

// Удаление трека
function deleteTrack(trackId) {
    if (confirm('Вы уверены, что хотите удалить этот трек?')) {
        // В реальной реализации будет вызов API
        console.log('Удаление трека:', trackId);
        loadUserTracks(); // Обновить список треков
    }
}

// Загрузка коллекций пользователя
function loadUserCollections() {
    // В реальной реализации будет вызов API
    // Для демонстрации используем тестовые данные
    const collections = [
        {
            collection_id: 1,
            name: 'Любимые треки',
            is_favorite: true,
            created_at: '2023-05-10 12:00:00',
            tracks: [
                { track_id: 1, title: 'Bohemian Rhapsody', artist_name: 'Queen' },
                { track_id: 2, title: 'Billie Jean', artist_name: 'Michael Jackson' }
            ]
        },
        {
            collection_id: 2,
            name: 'Рабочий плейлист',
            is_favorite: false,
            created_at: '2023-06-15 14:30:00',
            tracks: [
                { track_id: 3, title: 'So What', artist_name: 'Miles Davis' }
            ]
        }
    ];
    
    displayCollections(collections);
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
                    ${collection.tracks.map(track => 
                        `<li>${track.title} - ${track.artist_name} 
                           <button class="btn btn-secondary btn-sm" onclick="removeTrackFromCollection(${collection.collection_id}, ${track.track_id})">Удалить</button>
                           </li>`
                    ).join('')}
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
        is_favorite: document.getElementById('collection-favorite').checked,
        user_id: currentUser.user_id
    };
    
    // В реальной реализации будет вызов API
    console.log('Создание коллекции:', collectionData);
    
    closeModal();
    loadUserCollections(); // Обновить список коллекций
}

// Показать модальное окно редактирования коллекции
function showEditCollectionModal(collectionId) {
    // В реальной реализации будет загрузка данных коллекции
    alert(`Редактирование коллекции с ID: ${collectionId}`);
}

// Удаление коллекции
function deleteCollection(collectionId) {
    if (confirm('Вы уверены, что хотите удалить эту коллекцию?')) {
        // В реальной реализации будет вызов API
        console.log('Удаление коллекции:', collectionId);
        loadUserCollections(); // Обновить список коллекций
    }
}

// Выполнение поиска
function performSearch() {
    const title = document.getElementById('search-title').value;
    const artist = document.getElementById('search-artist').value;
    const genreId = document.getElementById('search-genre').value;
    const bpm = document.getElementById('search-bpm').value;
    const duration = document.getElementById('search-duration').value;
    
    // В реальной реализации будет вызов API с фильтрами
    // Для демонстрации используем тестовые данные
    const searchResults = [
        {
            track_id: 1,
            title: 'Bohemian Rhapsody',
            artist_name: 'Queen',
            genre_name: 'Рок',
            bpm: 70,
            duration_sec: 355,
            created_at: '2023-05-15 10:30:00'
        },
        {
            track_id: 4,
            title: 'Another One Bites the Dust',
            artist_name: 'Queen',
            genre_name: 'Рок',
            bpm: 110,
            duration_sec: 214,
            created_at: '2023-05-16 11:45:00'
        }
    ];
    
    displaySearchResults(searchResults);
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
    // В реальной реализации будет вызов API
    alert(`Трек с ID ${trackId} будет добавлен в коллекцию`);
}

// Показать модальное окно добавления трека в коллекцию
function showAddTrackToCollectionModal(collectionId) {
    // В реальной реализации будет загрузка доступных треков
    alert(`Добавление трека в коллекцию с ID: ${collectionId}`);
}

// Удаление трека из коллекции
function removeTrackFromCollection(collectionId, trackId) {
    if (confirm('Вы уверены, что хотите удалить этот трек из коллекции?')) {
        // В реальной реализации будет вызов API
        console.log(`Удаление трека ${trackId} из коллекции ${collectionId}`);
        loadUserCollections(); // Обновить список коллекций
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
    
    // В реальной реализации будет загрузка соответствующего контента
    const adminContent = document.querySelector('.admin-content');
    
    switch(tabName) {
        case 'users':
            adminContent.innerHTML = '<h3>Список пользователей</h3><p>Здесь будет отображаться список всех пользователей системы.</p>';
            break;
        case 'tracks':
            adminContent.innerHTML = '<h3>Все треки</h3><p>Здесь будет отображаться список всех треков в системе.</p>';
            break;
        case 'audit':
            adminContent.innerHTML = '<h3>Журнал операций</h3><p>Здесь будет отображаться журнал всех операций в системе.</p>';
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