let state = {
    tracks: [],
    playlists: [],
    currentView: 'all',
    currentTrackId: null
};

const audio = document.getElementById('audio-element');
const playPauseBtn = document.getElementById('play-pause-btn');
const vinylDisc = document.getElementById('vinyl-disc');
const progressBar = document.getElementById('progress-bar');

async function fetchState() {
    const res = await fetch('/api/state');
    const data = await res.json();
    state.tracks = data.tracks;
    state.playlists = data.playlists;
    renderSidebar();
    renderTracks();
}

function renderSidebar() {
    document.getElementById('all-count').textContent = state.tracks.length;
    const list = document.getElementById('playlists-list');
    list.innerHTML = '';

    document.querySelector('[data-id="all"]').classList.toggle('active', state.currentView === 'all');

    state.playlists.forEach(pl => {
        const item = document.createElement('div');
        item.className = `nav-item ${state.currentView === pl.id ? 'active' : ''}`;
        item.innerHTML = `
            <span>${pl.name} (${pl.track_ids.length})</span>
            ${pl.id !== 'default' ? `<button class="delete-pl" data-del="${pl.id}">✕</button>` : ''}
        `;
        item.onclick = (e) => {
            if (e.target.dataset.del) return;
            state.currentView = pl.id;
            document.getElementById('current-view-title').textContent = pl.name;
            renderSidebar();
            renderTracks();
        };
        list.appendChild(item);
    });

    document.querySelector('[data-id="all"]').onclick = () => {
        state.currentView = 'all';
        document.getElementById('current-view-title').textContent = 'All Tracks';
        renderSidebar();
        renderTracks();
    };

    document.querySelectorAll('[data-del]').forEach(btn => {
        btn.onclick = async () => {
            await fetch(`/api/playlists/${btn.dataset.del}`, { method: 'DELETE' });
            if (state.currentView === btn.dataset.del) state.currentView = 'all';
            fetchState();
        };
    });
}

function renderTracks() {
    const container = document.getElementById('tracks-list');
    container.innerHTML = '';

    let visibleTracks = state.tracks;
    if (state.currentView !== 'all') {
        const pl = state.playlists.find(p => p.id === state.currentView);
        visibleTracks = pl ? state.tracks.filter(t => pl.track_ids.includes(t.id)) : [];
    }

    if (visibleTracks.length === 0) {
        container.innerHTML = `<p style="color: var(--text-muted); font-size: 0.9rem; margin-top: 20px;">List is empty.</p>`;
        return;
    }

    visibleTracks.forEach(track => {
        const card = document.createElement('div');
        card.className = `track-card ${state.currentTrackId === track.id ? 'is-playing' : ''}`;

        const playlistItems = state.playlists
            .map(pl => `<div class="custom-option" data-add-to="${pl.id}" data-track="${track.id}">+ ${pl.name}</div>`)
            .join('');

        card.innerHTML = `
            <div class="track-left-side">
                <button class="play-row-btn" data-play="${track.id}">
                    ${state.currentTrackId === track.id && !audio.paused ? '❚❚' : '▶'}
                </button>
                <div class="track-details">
                    <h4>${track.title}</h4>
                    <span>${track.artist}</span>
                </div>
            </div>
            <div class="track-right-side">
                <div class="custom-select-wrapper">
                    <button class="custom-select-btn" data-dropdown-btn="${track.id}">Add to... ▾</button>
                    <div class="custom-select-dropdown" id="dropdown-${track.id}">
                        ${playlistItems}
                    </div>
                </div>
                <button class="btn-remove" data-remove="${track.id}">
                    ${state.currentView === 'all' ? 'Delete' : 'Remove'}
                </button>
            </div>
        `;
        container.appendChild(card);
    });

    // Обработчики для воспроизведения треков в списке
    document.querySelectorAll('[data-play]').forEach(btn => {
        btn.onclick = () => playTrack(btn.dataset.play);
    });

    // Логика открытия/закрытия кастомного меню выбора плейлиста
    document.querySelectorAll('[data-dropdown-btn]').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const trackId = btn.dataset.dropdownBtn;
            const dropdown = document.getElementById(`dropdown-${trackId}`);
            
            document.querySelectorAll('.custom-select-dropdown').forEach(d => {
                if (d !== dropdown) d.classList.remove('show');
            });
            
            dropdown.classList.toggle('show');
        };
    });

    // Клик вне меню закрывает его
    window.onclick = () => {
        document.querySelectorAll('.custom-select-dropdown').forEach(d => d.classList.remove('show'));
    };

    // Добавление трека в плейлист через кастомное меню
    document.querySelectorAll('[data-add-to]').forEach(item => {
        item.onclick = async () => {
            const plId = item.dataset.addTo;
            const trackId = item.dataset.track;
            await fetch(`/api/playlists/${plId}/tracks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ track_id: trackId })
            });
            fetchState();
        };
    });

    // Удаление трека
    document.querySelectorAll('[data-remove]').forEach(btn => {
        btn.onclick = async () => {
            const id = btn.dataset.remove;
            if (state.currentView === 'all') {
                await fetch(`/api/tracks/${id}`, { method: 'DELETE' });
            } else {
                await fetch(`/api/playlists/${state.currentView}/tracks/${id}`, { method: 'DELETE' });
            }
            fetchState();
        };
    });
}

function playTrack(id) {
    const track = state.tracks.find(t => t.id === id);
    if (!track) return;

    if (state.currentTrackId === id) {
        audio.paused ? audio.play() : audio.pause();
    } else {
        state.currentTrackId = id;
        audio.src = track.url;
        document.getElementById('player-title').textContent = track.title;
        document.getElementById('player-artist').textContent = track.artist;
        audio.play();
    }
    updateUI();
}

function updateUI() {
    const isPlaying = !audio.paused;
    playPauseBtn.textContent = isPlaying ? '❚❚' : '▶';
    vinylDisc.classList.toggle('spin', isPlaying);
    renderTracks();
}

playPauseBtn.onclick = () => {
    if (!state.currentTrackId && state.tracks.length > 0) {
        playTrack(state.tracks[0].id);
        return;
    }
    audio.paused ? audio.play() : audio.pause();
    updateUI();
};

audio.ontimeupdate = () => {
    if (!audio.duration) return;
    progressBar.value = (audio.currentTime / audio.duration) * 100;
    document.getElementById('current-time').textContent = formatTime(audio.currentTime);
    document.getElementById('duration').textContent = formatTime(audio.duration);
};

progressBar.oninput = () => {
    if (audio.duration) {
        audio.currentTime = (progressBar.value / 100) * audio.duration;
    }
};

audio.onended = () => {
    const idx = state.tracks.findIndex(t => t.id === state.currentTrackId);
    if (idx !== -1 && idx + 1 < state.tracks.length) {
        playTrack(state.tracks[idx + 1].id);
    } else {
        updateUI();
    }
};

function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

document.getElementById('create-playlist-btn').onclick = async () => {
    const input = document.getElementById('new-playlist-name');
    if (!input.value.trim()) return;
    await fetch('/api/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: input.value })
    });
    input.value = '';
    fetchState();
};

const modal = document.getElementById('upload-modal');
document.getElementById('open-upload-modal').onclick = () => modal.classList.add('active');
document.getElementById('close-modal').onclick = () => modal.classList.remove('active');

document.getElementById('upload-form').onsubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    await fetch('/api/tracks', { method: 'POST', body: formData });
    e.target.reset();
    modal.classList.remove('active');
    fetchState();
};

// Управление громкостью
const volumeBar = document.getElementById('volume-bar');
const muteBtn = document.getElementById('mute-btn');

const savedVolume = localStorage.getItem('playerVolume');
if (savedVolume !== null) {
    audio.volume = parseFloat(savedVolume);
    volumeBar.value = Math.round(audio.volume * 100);
} else {
    audio.volume = 0.8;
    volumeBar.value = 80;
}
updateVolumeIcon();

volumeBar.oninput = () => {
    audio.muted = false;
    audio.volume = volumeBar.value / 100;
    localStorage.setItem('playerVolume', audio.volume);
    updateVolumeIcon();
};

muteBtn.onclick = () => {
    audio.muted = !audio.muted;
    updateVolumeIcon();
};

function updateVolumeIcon() {
    if (audio.muted || audio.volume === 0) {
        muteBtn.textContent = '';
    } else if (audio.volume < 0.5) {
        muteBtn.textContent = '';
    } else {
        muteBtn.textContent = '';
    }
}

fetchState();