// 사용자 데이터 (실제로는 서버에서 관리되어야 함)
const users = {
    'teacher1': { password: '1', type: 'teacher', name: '김선생' },
    'teacher2': { password: '2', type: 'teacher', name: '이선생' },
    'admin': { password: 'admin123', type: 'admin', name: '관리자' }
};

// 학년반 기반 선생님 자동 생성 함수
function generateTeacherFromGradeClass(grade, classNum) {
    const teacherName = `${grade}학년 ${classNum}반 선생님`;
    return {
        username: `${grade}-${classNum}`,
        name: teacherName,
        type: 'teacher',
        grade: grade,
        class: classNum
    };
}

// 하루 단위 세션 확인
function isSessionValid(loginDate) {
    if (!loginDate) return false;
    const today = new Date().toDateString();
    const sessionDate = new Date(loginDate).toDateString();
    return today === sessionDate;
}

// 저장된 세션 확인 및 복원
function checkSavedSession() {
    const savedSession = localStorage.getItem('teacherSession');
    if (savedSession) {
        const session = JSON.parse(savedSession);
        if (isSessionValid(session.loginDate)) {
            currentUser = session.user;
            return true;
        } else {
            // 만료된 세션 제거
            localStorage.removeItem('teacherSession');
        }
    }
    return false;
}

// 신청 데이터 저장
let requests = {
    computerRoom: JSON.parse(localStorage.getItem('computerRoomRequests') || '[]'),
    science: JSON.parse(localStorage.getItem('scienceRequests') || '[]'),
    maintenance: JSON.parse(localStorage.getItem('maintenanceRequests') || '[]'),
    toner: JSON.parse(localStorage.getItem('tonerRequests') || '[]'),
    tabletRouter: JSON.parse(localStorage.getItem('tabletRouterRequests') || '[]')
};

// 태블릿 정보 데이터
let tabletInfo = JSON.parse(localStorage.getItem('tabletInfo') || '{"wifi": "", "password": "", "instructions": ""}');

// 현재 로그인된 사용자
let currentUser = null;

// 페이지 로드 시 실행
document.addEventListener('DOMContentLoaded', function() {
    // Firebase 초기화 대기 후 실행
    setTimeout(async () => {
        // Firebase 데이터 로드
        await loadFirebaseData();
        
        // 자동 로그인 비활성화 - 항상 로그인 화면 표시
        
        // 기존 저장된 세션 정리
        localStorage.removeItem('teacherSession');
        localStorage.removeItem('currentUser');
        
        // 학년별 반 개수 설정
        const classCountByGrade = {
            1: 7, // 1학년 7반까지
            2: 6, // 2학년 6반까지  
            3: 7, // 3학년 7반까지
            4: 6, // 4학년 6반까지
            5: 5, // 5학년 5반까지
            6: 6  // 6학년 6반까지
        };
        window.classCountByGrade = classCountByGrade;
        
        // 새로운 로그인 버튼 이벤트 리스너 추가
        setupGradeClassButtons();
        const adminForm = document.getElementById('adminForm');
        
        if (adminForm) {
            adminForm.addEventListener('submit', handleAdminLogin);
        }
        
        // 로그아웃 버튼 이벤트 리스너 추가 (안전한 방식)
        setupLogoutButton();
        
        updateAdminStats();
    }, 1000);
});

// Firebase 데이터 로드
async function loadFirebaseData() {
    const db = getDbManager();
    if (!db || !db.isConnected()) {
        console.log('💾 Firebase 미연결 - localStorage 데이터 사용');
        return;
    }
    
    try {
        console.log('🔄 Firebase에서 데이터 로드 중...');
        
        // 모든 컬렉션 데이터 로드
        const collections = [
            'computerRoomRequests',
            'tabletRouterRequests', 
            'scienceRequests',
            'maintenanceRequests',
            'tonerRequests'
        ];
        
        for (const collectionName of collections) {
            const data = await db.getDocuments(collectionName);
            
            // requests 객체 업데이트
            const requestType = collectionName.replace('Requests', '').replace('computerRoom', 'computerRoom').replace('tabletRouter', 'tabletRouter');
            if (requestType === 'computerRoom') {
                requests.computerRoom = data;
            } else if (requestType === 'tabletRouter') {
                requests.tabletRouter = data;
            } else {
                requests[requestType] = data;
            }
            
            console.log(`📄 ${collectionName}: ${data.length}개 로드됨`);
        }
        
        console.log('✅ Firebase 데이터 로드 완료');
    } catch (error) {
        console.error('❌ Firebase 데이터 로드 오류:', error);
    }
}

// 실시간 리스너 설정
function setupRealtimeListeners() {
    const db = getDbManager();
    if (!db.isConnected()) {
        return;
    }
    
    console.log('🔄 실시간 데이터 동기화 설정 중...');
    
    // 컴퓨터실 예약 실시간 감지
    db.setupRealtimeListener('computerRoomRequests', (data) => {
        requests.computerRoom = data;
        if (document.getElementById('weeklyScheduleContainer')) {
            updateWeeklySchedule();
        }
        updateAdminStats();
        updateMainDashboard(); // 메인 대시보드 업데이트
    });
    
    // 공유기 예약 실시간 감지  
    db.setupRealtimeListener('tabletRouterRequests', (data) => {
        requests.tabletRouter = data;
        if (document.getElementById('weeklyScheduleContainer')) {
            updateWeeklySchedule();
        }
        updateAdminStats();
        updateMainDashboard(); // 메인 대시보드 업데이트
    });
    
    // 기타 신청들 실시간 감지
    ['science', 'maintenance', 'toner'].forEach(type => {
        db.setupRealtimeListener(type + 'Requests', (data) => {
            requests[type] = data;
            updateAdminStats();
        });
    });
    
    console.log('✅ 실시간 데이터 동기화 활성화');
}

// 학년/반 버튼 설정
function setupGradeClassButtons() {
    // 학년 버튼 이벤트 리스너
    document.querySelectorAll('.grade-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const grade = e.target.dataset.grade;
            showClassSelection(grade);
        });
    });
}

// 로그아웃 버튼 설정
function setupLogoutButton() {
    const logoutBtn = document.querySelector('.logout-btn');
    if (logoutBtn) {
        // 기존 이벤트 제거 후 새로 추가
        logoutBtn.removeEventListener('click', logout);
        logoutBtn.addEventListener('click', logout);
        console.log('🔗 로그아웃 버튼 이벤트 리스너 설정 완료');
    } else {
        console.log('⚠️ 로그아웃 버튼을 찾을 수 없습니다');
    }
}

// 학년 선택 표시
function showGradeSelection() {
    document.querySelector('.grade-selection').style.display = 'block';
    document.querySelector('.class-selection').style.display = 'none';
}

// 반 선택 표시
function showClassSelection(grade) {
    const classCount = window.classCountByGrade[grade];
    
    // 제목 업데이트
    document.getElementById('selectedGradeTitle').textContent = `${grade}학년 반을 선택해주세요`;
    
    // 반 버튼 생성
    const classButtons = document.getElementById('classButtons');
    classButtons.innerHTML = '';
    
    for (let i = 1; i <= classCount; i++) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'class-btn';
        btn.textContent = `${i}반`;
        btn.addEventListener('click', () => {
            loginAsTeacher(grade, i);
        });
        classButtons.appendChild(btn);
    }
    
    // UI 전환
    document.querySelector('.grade-selection').style.display = 'none';
    document.querySelector('.class-selection').style.display = 'block';
}

// 선생님으로 로그인
function loginAsTeacher(grade, classNum) {
    // 선생님 정보 생성
    currentUser = generateTeacherFromGradeClass(grade, classNum);
    
    // 세션 저장하지 않음 (자동 로그인 방지)
    // localStorage.setItem('teacherSession', JSON.stringify(session));
    // localStorage.setItem('currentUser', JSON.stringify(currentUser));
    
    showUserSection();
}

// 관리자 로그인 처리
function handleAdminLogin(e) {
    e.preventDefault();
    
    const password = document.getElementById('adminPassword').value;
    
    if (password === 'admin123') {
        currentUser = {
            username: 'admin',
            name: '관리자',
            type: 'admin'
        };
        
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        showUserSection();
    } else {
        alert('관리자 비밀번호가 올바르지 않습니다.');
    }
}

// 기존 로그인 처리 (호환성을 위해 유지)
function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const userType = document.getElementById('userType').value;
    
    if (users[username] && users[username].password === password && users[username].type === userType) {
        currentUser = {
            username: username,
            name: users[username].name,
            type: users[username].type
        };
        
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        showUserSection();
    } else {
        alert('로그인 정보가 올바르지 않습니다.');
    }
}

// 사용자 섹션 표시
function showUserSection() {
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('userInfo').style.display = 'flex';
    document.getElementById('userName').textContent = currentUser.name + '님';
    
    if (currentUser.type === 'teacher') {
        document.getElementById('teacherSection').style.display = 'block';
        document.getElementById('adminSection').style.display = 'none';
    } else if (currentUser.type === 'admin') {
        document.getElementById('adminSection').style.display = 'block';
        document.getElementById('teacherSection').style.display = 'none';
        updateAdminStats();
    }
    
    // 로그아웃 버튼 재설정 (로그인 후 DOM이 업데이트되므로)
    setTimeout(() => {
        setupLogoutButton();
    }, 100);
}

// 로그아웃
function logout() {
    console.log('🚪 로그아웃 시작');
    
    currentUser = null;
    localStorage.removeItem('currentUser');
    localStorage.removeItem('teacherSession');
    
    // UI 상태 복구
    const loginSection = document.getElementById('loginSection');
    const userInfo = document.getElementById('userInfo');
    const teacherSection = document.getElementById('teacherSection');
    const adminSection = document.getElementById('adminSection');
    
    if (loginSection) loginSection.style.display = 'block';
    if (userInfo) userInfo.style.display = 'none';
    if (teacherSection) teacherSection.style.display = 'none';
    if (adminSection) adminSection.style.display = 'none';
    
    // 관리자 폼만 초기화 (존재할 경우)
    const adminForm = document.getElementById('adminForm');
    if (adminForm) {
        adminForm.reset();
    }
    
    // 학년/반 선택 상태 초기화
    showGradeSelection();
    
    console.log('✅ 로그아웃 완료');
}

// 페이지 열기 (선생님)
function openPage(page) {
    const content = document.querySelector('main');
    
    switch(page) {
        case 'computer-room':
            showComputerRoomForm();
            break;
        case 'tablet-info':
            showTabletInfo();
            break;
        case 'science-supplies':
            showScienceForm();
            break;
        case 'maintenance':
            showMaintenanceForm();
            break;
        case 'toner':
            showTonerForm();
            break;
    }
}

// 관리자 페이지 열기
function openAdminPage(page) {
    switch(page) {
        case 'computer-room-manage':
            showRequestManagement('computerRoom', '컴퓨터실 사용 신청');
            break;
        case 'tablet-manage':
            showTabletManagement();
            break;
        case 'science-manage':
            showRequestManagement('science', '과학실 준비물 신청');
            break;
        case 'maintenance-manage':
            showRequestManagement('maintenance', '컴퓨터 유지보수 신청');
            break;
        case 'toner-manage':
            showRequestManagement('toner', '토너 신청');
            break;
    }
}

// 기본 학년 배정 설정 (교시별) - 여러 학년 지원
const defaultAssignments = {
    computer: {
        '월': { '1교시': '3', '2교시': '3', '3교시': '3', '4교시': '3', '5교시': '3', '6교시': '3' },
        '화': { '1교시': '4', '2교시': '4', '3교시': '4', '4교시': '4', '5교시': '4', '6교시': '4' },
        '수': { '1교시': '1,2', '2교시': '1,2', '3교시': '1,2', '4교시': '1,2', '5교시': '1,2', '6교시': '1,2' },
        '목': { '1교시': '5', '2교시': '5', '3교시': '5', '4교시': '5', '5교시': '5', '6교시': '5' },
        '금': { '1교시': '6', '2교시': '6', '3교시': '6', '4교시': '6', '5교시': '6', '6교시': '6' }
    },
    router: {
        '월': { '1교시': '3', '2교시': '3', '3교시': '3', '4교시': '3', '5교시': '3', '6교시': '3' },
        '화': { '1교시': '3', '2교시': '3', '3교시': '3', '4교시': '3', '5교시': '3', '6교시': '3' },
        '수': { '1교시': '3', '2교시': '3', '3교시': '3', '4교시': '3', '5교시': '3', '6교시': '3' },
        '목': { '1교시': '4', '2교시': '4', '3교시': '4', '4교시': '4', '5교시': '4', '6교시': '4' },
        '금': { '1교시': '4', '2교시': '4', '3교시': '4', '4교시': '4', '5교시': '4', '6교시': '4' }
    }
};

let currentFacility = 'computer'; // 'computer' 또는 'router'
let currentWeekStart = null;

// 주간 예약 제한 (개인당 시설별 1회)
const WEEKLY_RESERVATION_LIMIT = 1;

// 현재 주의 사용자 예약 상태 확인
function getUserReservationStatus(userInfo) {
    if (!userInfo) return { computer: null, router: null };
    
    const today = new Date();
    const thisMonday = new Date(today);
    thisMonday.setDate(today.getDate() - today.getDay() + 1);
    
    const weekEnd = new Date(thisMonday);
    weekEnd.setDate(thisMonday.getDate() + 4); // 금요일까지
    
    const weekStartStr = thisMonday.toISOString().split('T')[0];
    const weekEndStr = weekEnd.toISOString().split('T')[0];
    
    // 컴퓨터실 예약 확인
    const computerReservation = (requests.computerRoom || []).find(req => 
        req.useDate >= weekStartStr && 
        req.useDate <= weekEndStr &&
        req.requester === userInfo.name &&
        req.requesterGrade == userInfo.grade &&
        req.requesterClass == userInfo.class &&
        (req.status === 'approved' || req.status === 'pending')
    );
    
    // 공유기 예약 확인
    const routerReservation = (requests.tabletRouter || []).find(req => 
        req.useDate >= weekStartStr && 
        req.useDate <= weekEndStr &&
        req.requester === userInfo.name &&
        req.requesterGrade == userInfo.grade &&
        req.requesterClass == userInfo.class &&
        (req.status === 'approved' || req.status === 'pending')
    );
    
    return {
        computer: computerReservation,
        router: routerReservation
    };
}

// 특정 주간의 개인 예약 횟수 확인
function getWeeklyReservationCount(weekStart, facility, userInfo) {
    const facilityRequests = facility === 'computer' ? 
        (requests.computerRoom || []) : 
        (requests.tabletRouter || []);
    
    // 주간 범위 계산 (월요일부터 금요일까지)
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 4); // 금요일까지
    
    const weekStartStr = weekStart.toISOString().split('T')[0];
    const weekEndStr = weekEnd.toISOString().split('T')[0];
    
    // 해당 주간의 개인 예약 개수 세기
    const userReservations = facilityRequests.filter(req => 
        req.useDate >= weekStartStr && 
        req.useDate <= weekEndStr &&
        req.requester === userInfo.name &&
        req.requesterGrade == userInfo.grade &&
        req.requesterClass == userInfo.class &&
        (req.status === 'approved' || req.status === 'pending')
    );
    
    console.log(`📊 ${facility} 주간 예약 확인:`, {
        weekStart: weekStartStr,
        weekEnd: weekEndStr,
        userInfo: userInfo,
        userReservations: userReservations,
        count: userReservations.length
    });
    
    return userReservations.length;
}

// 주간 예약 제한 체크
function checkWeeklyReservationLimit(weekStart, facility, userInfo) {
    const currentCount = getWeeklyReservationCount(weekStart, facility, userInfo);
    const facilityName = facility === 'computer' ? '컴퓨터실' : '공유기';
    
    if (currentCount >= WEEKLY_RESERVATION_LIMIT) {
        alert(`⚠️ ${facilityName} 주간 사용 제한\n\n개인당 1주일에 1번만 예약 가능합니다.\n현재 이번 주 사용 횟수: ${currentCount}/${WEEKLY_RESERVATION_LIMIT}\n\n기존 예약을 취소한 후 다시 시도해주세요.`);
        return false;
    }
    
    return true;
}

// 컴퓨터실 신청 폼 - 주간 시간표 형태
function showComputerRoomForm() {
    const content = document.querySelector('main');
    
    content.innerHTML = `
        <button onclick="goBack()" class="back-btn">← 돌아가기</button>
        <div class="schedule-container">
            <h2 style="text-align: center; color: #2d3748; margin-bottom: 1.5rem; font-size: 1.75rem; font-weight: 600;">시설 사용 신청</h2>
            
            <div class="facility-tabs">
                <div class="facility-tab active" onclick="switchFacility('computer')">
                    컴퓨터실
                </div>
                <div class="facility-tab" onclick="switchFacility('router')">
                    공유기 (늘봄교실3)
                </div>
            </div>
            
            <div class="date-selector">
                <label for="weekSelector">주차 선택:</label>
                <select id="weekSelector" onchange="updateWeeklySchedule()">
                    <!-- 옵션은 JavaScript에서 동적으로 생성됩니다 -->
                </select>
            </div>
            
            <div class="schedule-legend">
                <div class="legend-item">
                    <div class="legend-color legend-available"></div>
                    <span>예약 가능</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color legend-occupied"></div>
                    <span>예약됨</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color legend-mine"></div>
                    <span>내 예약</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color legend-assigned"></div>
                    <span>우리 학년 전용</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color legend-default"></div>
                    <span>다른 학년 전용</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color legend-limit"></div>
                    <span>주간 한도 달성</span>
                </div>
            </div>
            
            <div id="weeklyScheduleContainer">
                <!-- 주간 시간표가 여기에 동적으로 생성됩니다 -->
            </div>
        </div>
        
        <!-- 예약 확인 모달 -->
        <div id="reservationModal" class="reservation-modal">
            <div class="modal-content">
                <div class="modal-header">
                    <h3 id="modalTitle">시설 예약</h3>
                    <p id="modalSubtitle">선택한 시간에 예약하시겠습니까?</p>
                </div>
                <div class="modal-form">
                    <!-- 사용목적 입력 필드 제거됨 -->
                </div>
                <div class="modal-actions">
                    <button class="modal-btn secondary" onclick="closeReservationModal()">취소</button>
                    <button class="modal-btn primary" onclick="confirmReservation()">예약하기</button>
                </div>
            </div>
        </div>
    `;
    
    // 현재 주차로 초기화
    initializeWeekSelector();
    updateWeeklySchedule();
}

// 태블릿 정보 보기
function showTabletInfo() {
    const content = document.querySelector('main');
    content.innerHTML = `
        <button onclick="goBack()" class="back-btn">← 돌아가기</button>
        <div class="request-form">
            <h2>태블릿 공유기 정보</h2>
            <div class="form-group">
                <label>Wi-Fi 이름:</label>
                <p style="padding: 12px; background: #f7fafc; border-radius: 5px; margin-top: 5px;">${tabletInfo.wifi || '정보가 없습니다.'}</p>
            </div>
            <div class="form-group">
                <label>Wi-Fi 비밀번호:</label>
                <p style="padding: 12px; background: #f7fafc; border-radius: 5px; margin-top: 5px;">${tabletInfo.password || '정보가 없습니다.'}</p>
            </div>
            <div class="form-group">
                <label>사용 안내:</label>
                <p style="padding: 12px; background: #f7fafc; border-radius: 5px; margin-top: 5px; white-space: pre-wrap;">${tabletInfo.instructions || '안내사항이 없습니다.'}</p>
            </div>
        </div>
    `;
}

// 과학실 준비물 신청 폼
function showScienceForm() {
    const content = document.querySelector('main');
    content.innerHTML = `
        <button onclick="goBack()" class="back-btn">← 돌아가기</button>
        <div class="request-form">
            <h2>과학실 준비물 신청</h2>
            <form id="scienceForm">
                <div class="form-group">
                    <label for="requestDate">신청일:</label>
                    <input type="date" id="requestDate" name="requestDate" required>
                </div>
                <div class="form-group">
                    <label for="needDate">필요일:</label>
                    <input type="date" id="needDate" name="needDate" required>
                </div>
                <div class="form-group">
                    <label for="items">준비물 목록:</label>
                    <textarea id="items" name="items" rows="4" placeholder="필요한 준비물을 자세히 적어주세요" required></textarea>
                </div>
                <div class="form-group">
                    <label for="quantity">수량:</label>
                    <input type="number" id="quantity" name="quantity" min="1" required>
                </div>
                <div class="form-group">
                    <label for="purpose">사용 목적:</label>
                    <textarea id="purpose" name="purpose" rows="3" required></textarea>
                </div>
                <button type="submit">신청하기</button>
            </form>
        </div>
    `;
    
    document.getElementById('scienceForm').addEventListener('submit', function(e) {
        e.preventDefault();
        submitRequest('science', {
            requestDate: document.getElementById('requestDate').value,
            needDate: document.getElementById('needDate').value,
            items: document.getElementById('items').value,
            quantity: document.getElementById('quantity').value,
            purpose: document.getElementById('purpose').value
        });
    });
    
    document.getElementById('requestDate').value = new Date().toISOString().split('T')[0];
}

// 유지보수 신청 폼
function showMaintenanceForm() {
    const content = document.querySelector('main');
    content.innerHTML = `
        <button onclick="goBack()" class="back-btn">← 돌아가기</button>
        <div class="request-form">
            <h2>컴퓨터 유지보수 신청</h2>
            <form id="maintenanceForm">
                <div class="form-group">
                    <label for="requestDate">신청일:</label>
                    <input type="date" id="requestDate" name="requestDate" required>
                </div>
                <div class="form-group">
                    <label for="location">위치:</label>
                    <input type="text" id="location" name="location" placeholder="예: 3층 컴퓨터실" required>
                </div>
                <div class="form-group">
                    <label for="problem">문제점:</label>
                    <textarea id="problem" name="problem" rows="4" placeholder="어떤 문제가 발생했는지 자세히 설명해주세요" required></textarea>
                </div>
                <div class="form-group">
                    <label for="urgency">긴급도:</label>
                    <select id="urgency" name="urgency" required>
                        <option value="">선택하세요</option>
                        <option value="낮음">낮음</option>
                        <option value="보통">보통</option>
                        <option value="높음">높음</option>
                        <option value="긴급">긴급</option>
                    </select>
                </div>
                <button type="submit">신청하기</button>
            </form>
        </div>
    `;
    
    document.getElementById('maintenanceForm').addEventListener('submit', function(e) {
        e.preventDefault();
        submitRequest('maintenance', {
            requestDate: document.getElementById('requestDate').value,
            location: document.getElementById('location').value,
            problem: document.getElementById('problem').value,
            urgency: document.getElementById('urgency').value
        });
    });
    
    document.getElementById('requestDate').value = new Date().toISOString().split('T')[0];
}

// 토너 신청 폼
function showTonerForm() {
    const content = document.querySelector('main');
    content.innerHTML = `
        <button onclick="goBack()" class="back-btn">← 돌아가기</button>
        <div class="request-form">
            <h2>토너 신청</h2>
            <form id="tonerForm">
                <div class="form-group">
                    <label for="requestDate">신청일:</label>
                    <input type="date" id="requestDate" name="requestDate" required>
                </div>
                <div class="form-group">
                    <label for="printerModel">프린터 모델:</label>
                    <input type="text" id="printerModel" name="printerModel" placeholder="예: HP LaserJet P1102" required>
                </div>
                <div class="form-group">
                    <label for="tonerType">토너 종류:</label>
                    <select id="tonerType" name="tonerType" required>
                        <option value="">선택하세요</option>
                        <option value="검정">검정</option>
                        <option value="컬러">컬러</option>
                        <option value="검정+컬러">검정+컬러</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="quantity">수량:</label>
                    <input type="number" id="quantity" name="quantity" min="1" required>
                </div>
                <div class="form-group">
                    <label for="location">설치 위치:</label>
                    <input type="text" id="location" name="location" placeholder="예: 2층 교무실" required>
                </div>
                <button type="submit">신청하기</button>
            </form>
        </div>
    `;
    
    document.getElementById('tonerForm').addEventListener('submit', function(e) {
        e.preventDefault();
        submitRequest('toner', {
            requestDate: document.getElementById('requestDate').value,
            printerModel: document.getElementById('printerModel').value,
            tonerType: document.getElementById('tonerType').value,
            quantity: document.getElementById('quantity').value,
            location: document.getElementById('location').value
        });
    });
    
    document.getElementById('requestDate').value = new Date().toISOString().split('T')[0];
}

// 신청 제출 (Firebase 지원, 자동 승인)
async function submitRequest(type, data) {
    // dbManager 안전 접근
    const db = getDbManager();
    
    const request = {
        id: Date.now(),
        requester: currentUser.name,
        requesterGrade: currentUser.grade || null,
        requesterClass: currentUser.class || null,
        status: 'approved', // 자동 승인
        submittedAt: new Date().toLocaleString('ko-KR'),
        processedAt: new Date().toLocaleString('ko-KR'), // 바로 처리
        schoolName: '두정초등학교', // 학교 구분 추가
        ...data
    };
    
    try {
        // 데이터베이스에 저장 (Firebase 또는 localStorage)
        const collectionName = type + 'Requests';
        await db.addDocument(collectionName, request);
        
        // 로컬 requests 객체 즉시 업데이트 (기존 코드 호환성을 위해)
        if (!requests[type]) {
            requests[type] = [];
        }
        requests[type].push(request);
        
        // localStorage도 직접 업데이트
        const storageKey = type + 'Requests';
        localStorage.setItem(storageKey, JSON.stringify(requests[type]));
        
        console.log('✅ 로컬 메모리 및 저장소 업데이트 완료:', type, request);
        
        // 신청 타입별 메시지
        const typeNames = {
            'science': '과학실 준비물',
            'maintenance': '컴퓨터 유지보수',
            'toner': '토너'
        };
        
        const statusMsg = db.isConnected() ? 
            '실시간 데이터베이스에 저장되어 관리자가 바로 확인할 수 있습니다!' : 
            '로컬에 저장되었습니다 (데모 모드)';
        
        alert(`🎉 ${typeNames[type]} 신청이 완료되었습니다!\n바로 사용 가능합니다.\n\n${statusMsg}`);
        
    } catch (error) {
        console.error('신청 저장 오류:', error);
        alert('❌ 신청 저장 중 오류가 발생했습니다. 다시 시도해주세요.');
        return;
    }
    
    updateAdminStats();
    goBack();
}

// 신청 관리 화면
function showRequestManagement(type, title) {
    const content = document.querySelector('main');
    const requestList = requests[type] || [];
    
    let tableRows = '';
    requestList.forEach(request => {
        const statusClass = `status-${request.status}`;
        const statusText = request.status === 'pending' ? '대기중' : 
                          request.status === 'approved' ? '승인' : '거절';
        
        tableRows += `
            <tr>
                <td>${request.id}</td>
                <td>${request.requester}</td>
                <td>${request.submittedAt}</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td>
                    ${request.status === 'pending' ? `
                        <button class="action-btn approve-btn" onclick="updateRequestStatus('${type}', ${request.id}, 'approved')">승인</button>
                        <button class="action-btn reject-btn" onclick="updateRequestStatus('${type}', ${request.id}, 'rejected')">거절</button>
                    ` : '완료'}
                </td>
            </tr>
        `;
    });
    
    content.innerHTML = `
        <button onclick="goBack()" class="back-btn">← 돌아가기</button>
        <h2>${title} 관리</h2>
        <table class="requests-table">
            <thead>
                <tr>
                    <th>신청번호</th>
                    <th>신청자</th>
                    <th>신청일시</th>
                    <th>상태</th>
                    <th>액션</th>
                </tr>
            </thead>
            <tbody>
                ${tableRows || '<tr><td colspan="5" style="text-align: center; padding: 40px;">신청이 없습니다.</td></tr>'}
            </tbody>
        </table>
    `;
}

// 태블릿 관리 화면
function showTabletManagement() {
    const content = document.querySelector('main');
    content.innerHTML = `
        <button onclick="goBack()" class="back-btn">← 돌아가기</button>
        <div class="request-form">
            <h2>태블릿 공유기 정보 관리</h2>
            <form id="tabletManageForm">
                <div class="form-group">
                    <label for="wifi">Wi-Fi 이름:</label>
                    <input type="text" id="wifi" name="wifi" value="${tabletInfo.wifi}">
                </div>
                <div class="form-group">
                    <label for="password">Wi-Fi 비밀번호:</label>
                    <input type="text" id="password" name="password" value="${tabletInfo.password}">
                </div>
                <div class="form-group">
                    <label for="instructions">사용 안내:</label>
                    <textarea id="instructions" name="instructions" rows="6">${tabletInfo.instructions}</textarea>
                </div>
                <button type="submit">저장하기</button>
            </form>
        </div>
    `;
    
    document.getElementById('tabletManageForm').addEventListener('submit', function(e) {
        e.preventDefault();
        tabletInfo = {
            wifi: document.getElementById('wifi').value,
            password: document.getElementById('password').value,
            instructions: document.getElementById('instructions').value
        };
        localStorage.setItem('tabletInfo', JSON.stringify(tabletInfo));
        alert('정보가 저장되었습니다.');
    });
}

// 신청 상태 업데이트
function updateRequestStatus(type, id, status) {
    const requestIndex = requests[type].findIndex(req => req.id === id);
    if (requestIndex !== -1) {
        requests[type][requestIndex].status = status;
        requests[type][requestIndex].processedAt = new Date().toLocaleString('ko-KR');
        localStorage.setItem(type + 'Requests', JSON.stringify(requests[type]));
        
        alert(`신청이 ${status === 'approved' ? '승인' : '거절'}되었습니다.`);
        updateAdminStats();
        showRequestManagement(type, getTypeTitle(type));
    }
}

// 타입별 제목 가져오기
function getTypeTitle(type) {
    const titles = {
        computerRoom: '컴퓨터실 사용 신청',
        science: '과학실 준비물 신청',
        maintenance: '컴퓨터 유지보수 신청',
        toner: '토너 신청'
    };
    return titles[type] || '';
}

// 관리자 통계 업데이트
function updateAdminStats() {
    if (currentUser && currentUser.type === 'admin') {
        const today = new Date().toDateString();
        let totalRequests = 0;
        let pendingRequests = 0;
        let todayProcessed = 0;
        
        // 모든 요청 타입 포함 (공유기 포함)
        Object.values(requests).forEach(requestList => {
            if (Array.isArray(requestList)) {
                totalRequests += requestList.length;
                requestList.forEach(request => {
                    if (request.status === 'pending') {
                        pendingRequests++;
                    }
                    if (request.processedAt && new Date(request.processedAt).toDateString() === today) {
                        todayProcessed++;
                    }
                });
            }
        });
        
        const pendingEl = document.getElementById('pendingRequests');
        const todayEl = document.getElementById('todayProcessed');
        const totalEl = document.getElementById('totalRequests');
        
        if (pendingEl) pendingEl.textContent = pendingRequests;
        if (todayEl) todayEl.textContent = todayProcessed;
        if (totalEl) totalEl.textContent = totalRequests;
    }
}

// 시설 전환
function switchFacility(facility) {
    currentFacility = facility;
    
    // 탭 활성화 상태 변경
    document.querySelectorAll('.facility-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    event.target.classList.add('active');
    
    console.log(`🔄 시설 전환: ${facility}`);
    
    // 시간표 업데이트 (제한 상태 재계산 포함)
    updateWeeklySchedule();
}

// 주차 선택기 초기화
function initializeWeekSelector() {
    const weekSelector = document.getElementById('weekSelector');
    if (!weekSelector) {
        console.error('weekSelector 요소를 찾을 수 없습니다.');
        return;
    }
    
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0: 일요일, 1: 월요일, ..., 6: 토요일
    
    // 이번 주의 월요일 구하기
    const thisMonday = new Date(today);
    thisMonday.setDate(today.getDate() - today.getDay() + 1);
    
    // 다음 주의 월요일 구하기
    const nextMonday = new Date(thisMonday);
    nextMonday.setDate(thisMonday.getDate() + 7);
    
    // 주차 선택기 옵션 설정
    setupWeekSelectorOptions(weekSelector, thisMonday, nextMonday, dayOfWeek >= 4); // 목요일(4)부터 다음주 가능
    
    // 기본값 설정 (이번 주)
    const thisYear = thisMonday.getFullYear();
    const thisWeekNumber = getWeekNumber(thisMonday);
    const thisWeekValue = `${thisYear}-W${thisWeekNumber.toString().padStart(2, '0')}`;
    
    weekSelector.value = thisWeekValue;
    currentWeekStart = new Date(thisMonday);
    
    console.log('📅 주차 선택기 초기화:', thisWeekValue, thisMonday);
    console.log('🗓️ 다음주 신청 가능 여부:', dayOfWeek >= 4 ? '가능 (목요일 이후)' : '불가능 (수요일 이전)');
}

// 주차 선택기 옵션 설정
function setupWeekSelectorOptions(weekSelector, thisMonday, nextMonday, canSelectNextWeek) {
    // 기존 옵션 제거
    weekSelector.innerHTML = '';
    
    // 이번 주 추가
    const thisYear = thisMonday.getFullYear();
    const thisWeekNumber = getWeekNumber(thisMonday);
    const thisWeekValue = `${thisYear}-W${thisWeekNumber.toString().padStart(2, '0')}`;
    const thisWeekText = `이번 주 (${thisMonday.getMonth() + 1}/${thisMonday.getDate()})`;
    
    const thisWeekOption = document.createElement('option');
    thisWeekOption.value = thisWeekValue;
    thisWeekOption.textContent = thisWeekText;
    weekSelector.appendChild(thisWeekOption);
    
    // 다음 주 추가 (목요일부터 가능)
    if (canSelectNextWeek) {
        const nextYear = nextMonday.getFullYear();
        const nextWeekNumber = getWeekNumber(nextMonday);
        const nextWeekValue = `${nextYear}-W${nextWeekNumber.toString().padStart(2, '0')}`;
        const nextWeekText = `다음 주 (${nextMonday.getMonth() + 1}/${nextMonday.getDate()})`;
        
        const nextWeekOption = document.createElement('option');
        nextWeekOption.value = nextWeekValue;
        nextWeekOption.textContent = nextWeekText;
        weekSelector.appendChild(nextWeekOption);
    }
    
    // select 요소는 이미 올바른 태그이므로 type 변경 불필요
}

// 주차 번호 계산
function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    return Math.ceil((((d - yearStart) / 86400000) + 1)/7);
}

// 주간 시간표 업데이트
function updateWeeklySchedule() {
    const weekSelector = document.getElementById('weekSelector');
    const container = document.getElementById('weeklyScheduleContainer');
    
    if (!weekSelector || !container) {
        console.error('주간 시간표 요소들을 찾을 수 없습니다.');
        return;
    }
    
    if (!weekSelector.value) {
        console.log('주차가 선택되지 않았습니다.');
        return;
    }
    
    try {
        // 선택된 주의 월요일 계산
        const [year, week] = weekSelector.value.split('-W');
        const monday = getDateFromWeek(parseInt(year), parseInt(week));
        currentWeekStart = monday;
        
        const scheduleTable = generateWeeklyScheduleTable();
        container.innerHTML = scheduleTable;
        
        console.log('📅 주간 시간표 업데이트 완료:', weekSelector.value);
        console.log('📊 현재 requests 상태:', requests);
    } catch (error) {
        console.error('주간 시간표 업데이트 오류:', error);
        container.innerHTML = '<p style="text-align: center; color: #e53e3e;">시간표를 불러올 수 없습니다.</p>';
    }
}

// 주차로부터 날짜 계산
function getDateFromWeek(year, week) {
    const jan4 = new Date(year, 0, 4);
    const monday = new Date(jan4);
    monday.setDate(jan4.getDate() - jan4.getDay() + 1 + (week - 1) * 7);
    return monday;
}

// 주간 시간표 테이블 생성
function generateWeeklyScheduleTable() {
    const periods = [
        { name: '1교시', time: '09:00-09:40' },
        { name: '2교시', time: '09:50-10:30' },
        { name: '3교시', time: '10:40-11:20' },
        { name: '4교시', time: '11:30-12:10' },
        { name: '5교시', time: '13:10-13:50' },
        { name: '6교시', time: '14:00-14:40' }
    ];
    
    const weekdays = ['월', '화', '수', '목', '금'];
    
    let tableHTML = `
        <table class="weekly-schedule-table">
            <thead>
                <tr>
                    <th class="period-header">교시</th>
    `;
    
    // 요일 헤더
    weekdays.forEach((day, index) => {
        const date = new Date(currentWeekStart);
        date.setDate(currentWeekStart.getDate() + index);
        const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
        tableHTML += `<th>${day}<br><small>${dateStr}</small></th>`;
    });
    
    tableHTML += `
                </tr>
            </thead>
            <tbody>
    `;
    
    // 교시별 행 생성
    periods.forEach((period, periodIndex) => {
        tableHTML += `
            <tr>
                <th class="period-header">${period.name}<br><small>${period.time}</small></th>
        `;
        
        weekdays.forEach((day, dayIndex) => {
            const date = new Date(currentWeekStart);
            date.setDate(currentWeekStart.getDate() + dayIndex);
            const dateStr = date.toISOString().split('T')[0];
            
            const cellStatus = getWeeklyCellStatus(day, period.name, dateStr);
            const cellClass = cellStatus.status;
            const cellData = cellStatus.grade ? `data-grade="${cellStatus.grade}"` : '';
            const onClick = cellStatus.clickable ? 
                `onclick="handleWeeklyCellClick('${dateStr}', '${period.name}', '${period.time}', '${day}', '${cellClass}')"` : '';
            
            // 텍스트는 한 곳에서만 표시 - CSS에서 처리하지 않고 여기서 직접 표시
            const displayText = cellStatus.content || '';
            
            tableHTML += `
                <td>
                    <button class="schedule-cell ${cellClass}" ${cellData} ${onClick}>
                        ${displayText}
                    </button>
                </td>
            `;
        });
        
        tableHTML += `</tr>`;
    });
    
    tableHTML += `
            </tbody>
        </table>
    `;
    
    return tableHTML;
}

// 주간 시간표 셀 상태 확인
function getWeeklyCellStatus(day, period, dateStr) {
    const facilityType = currentFacility === 'computer' ? 'computerRoom' : 'router';
    const facilityRequests = currentFacility === 'computer' ? 
        (requests.computerRoom || []) : 
        (requests.tabletRouter || []);
    
    console.log(`🔍 셀 상태 확인: ${day} ${period} ${dateStr}`, {
        facilityRequests: facilityRequests,
        currentUser: currentUser
    });
    
    // 예약 상태를 먼저 확인 (기본 배정보다 우선)
    const existingReservation = facilityRequests.find(req => 
        req.useDate === dateStr && 
        req.useTime === period && 
        (req.status === 'approved' || req.status === 'pending')
    );
    
    if (existingReservation) {
        console.log(`📋 예약 찾음:`, existingReservation);
        console.log(`👤 현재 사용자:`, currentUser);
        
        if (existingReservation.requester === currentUser.name && 
            existingReservation.requesterGrade == currentUser.grade && 
            existingReservation.requesterClass == currentUser.class) {
            console.log(`✅ 내 예약 확인됨`);
            return { 
                status: 'my-reservation', 
                content: '내 예약',
                clickable: true 
            };
        } else {
            console.log(`❌ 다른 사람 예약`);
            const gradeClass = existingReservation.requesterGrade && existingReservation.requesterClass ? 
                `${existingReservation.requesterGrade}-${existingReservation.requesterClass}` : 
                existingReservation.requester;
            return { 
                status: 'occupied', 
                content: gradeClass,
                clickable: false 
            };
        }
    }
    
    // 기본 배정 확인 (예약이 없을 때만)
    const dayAssignments = defaultAssignments[currentFacility][day];
    const assignedGrade = dayAssignments ? dayAssignments[period] : null;
    
    if (assignedGrade) {
        // 여러 학년 지원 (쉼표로 구분)
        const assignedGrades = assignedGrade.split(',');
        const canAccess = currentUser && currentUser.grade && 
                         assignedGrades.includes(currentUser.grade.toString());
        
        // 표시할 텍스트 생성
        const displayText = assignedGrades.length > 1 ? 
            `${assignedGrades.join(',')}학년 전용` : 
            `${assignedGrade}학년 전용`;
        
        return { 
            status: canAccess ? 'assigned-available' : 'default-assigned',
            grade: assignedGrade,
            content: displayText,
            clickable: canAccess
        };
    }
    
    // 예약 제한 확인 (예약 가능한 셀에 대해서만)
    const currentCount = getWeeklyReservationCount(currentWeekStart, currentFacility, currentUser);
    if (currentCount >= WEEKLY_RESERVATION_LIMIT) {
        return { 
            status: 'limit-reached', 
            content: '주간 한도 달성',
            clickable: false 
        };
    }
    
    return { 
        status: 'available', 
        content: '예약가능',
        clickable: true 
    };
}

// 주간 시간표 셀 클릭 처리
function handleWeeklyCellClick(date, period, time, day, currentStatus) {
    if (currentStatus === 'my-reservation') {
        // 내 예약 취소 확인
        if (confirm(`${day}요일 ${period} (${time}) 예약을 취소하시겠습니까?`)) {
            cancelWeeklyReservation(date, period);
        }
        return;
    }
    
    if (currentStatus === 'default-assigned') {
        alert('이 시간은 다른 학년에 배정된 시간입니다.');
        return;
    }
    
    // 새 예약 - 주간 제한 체크
    if (!checkWeeklyReservationLimit(currentWeekStart, currentFacility, currentUser)) {
        return; // 제한 초과 시 예약 중단
    }
    
    selectedSlot = { date, period, time, day };
    
    const facilityName = currentFacility === 'computer' ? '컴퓨터실' : '공유기 (늘봄교실3)';
    const currentCount = getWeeklyReservationCount(currentWeekStart, currentFacility, currentUser);
    
    document.getElementById('modalTitle').textContent = `${facilityName} ${period} 예약`;
    document.getElementById('modalSubtitle').textContent = `${date} (${day}요일) ${time}에 ${facilityName}을 예약하시겠습니까?\n\n📊 이번 주 사용 현황: ${currentCount}/${WEEKLY_RESERVATION_LIMIT}회`;
    
    const modal = document.getElementById('reservationModal');
    modal.classList.add('active');
}

// 주간 예약 취소
function cancelWeeklyReservation(date, period) {
    const facilityType = currentFacility === 'computer' ? 'computerRoom' : 'tabletRouter';
    const storageKey = currentFacility === 'computer' ? 'computerRoomRequests' : 'tabletRouterRequests';
    const facilityRequests = currentFacility === 'computer' ? 
        (requests.computerRoom || []) : 
        (requests.tabletRouter || []);
    
    const reservationIndex = facilityRequests.findIndex(req => 
        req.useDate === date && 
        req.useTime === period && 
        req.requester === currentUser.name && 
        req.requesterGrade == currentUser.grade && 
        req.requesterClass == currentUser.class
    );
    
    if (reservationIndex !== -1) {
        facilityRequests.splice(reservationIndex, 1);
        localStorage.setItem(storageKey, JSON.stringify(facilityRequests));
        
        if (currentFacility === 'computer') {
            requests.computerRoom = facilityRequests;
        } else {
            requests.tabletRouter = facilityRequests;
        }
        
        alert('예약이 취소되었습니다.');
        updateWeeklySchedule();
        updateAdminStats();
    }
}

// 시간표 업데이트 (기존 함수 - 호환성을 위해 유지)
function updateSchedule() {
    const selectedDate = document.getElementById('scheduleDate').value;
    const scheduleGrid = document.getElementById('scheduleGrid');
    
    const timeSlots = [
        { period: '1교시', time: '09:00-09:40' },
        { period: '2교시', time: '09:50-10:30' },
        { period: '3교시', time: '10:40-11:20' },
        { period: '4교시', time: '11:30-12:10' },
        { period: '5교시', time: '13:10-13:50' },
        { period: '6교시', time: '14:00-14:40' }
    ];
    
    let gridHTML = '';
    
    timeSlots.forEach(slot => {
        const slotStatus = getSlotStatus(selectedDate, slot.period);
        const statusClass = slotStatus.status;
        const isClickable = statusClass === 'available' || statusClass === 'my-reservation';
        const onClick = isClickable ? `onclick="handleSlotClick('${selectedDate}', '${slot.period}', '${slot.time}', '${statusClass}')"` : '';
        
        gridHTML += `
            <div class="time-slot ${statusClass}" ${slotStatus.requester ? `data-content="${slotStatus.requester}"` : ''} ${onClick}>
                <h4>${slot.period}</h4>
                <p>${slot.time}</p>
                ${slotStatus.requester && statusClass !== 'occupied' ? `<div style="position: absolute; bottom: 0.5rem; left: 50%; transform: translateX(-50%); font-size: 0.7rem; opacity: 0.7; z-index: 15;">${slotStatus.requester}</div>` : ''}
            </div>
        `;
    });
    
    scheduleGrid.innerHTML = gridHTML;
}

// 시간대별 예약 상태 확인
function getSlotStatus(date, period) {
    const computerRoomRequests = requests.computerRoom || [];
    
    // 선택된 날짜와 시간에 해당하는 승인된 예약 찾기
    const existingReservation = computerRoomRequests.find(req => 
        req.useDate === date && 
        req.useTime === period && 
        req.status === 'approved'
    );
    
    if (existingReservation) {
        // 내 예약인지 확인
        if (existingReservation.requester === currentUser.name && 
            existingReservation.requesterGrade == currentUser.grade && 
            existingReservation.requesterClass == currentUser.class) {
            return { status: 'my-reservation', requester: existingReservation.requester };
        } else {
            const gradeClass = existingReservation.requesterGrade && existingReservation.requesterClass ? 
                `${existingReservation.requesterGrade}-${existingReservation.requesterClass}` : 
                existingReservation.requester;
            return { status: 'occupied', requester: gradeClass };
        }
    }
    
    // 대기중인 예약이 있는지 확인
    const pendingReservation = computerRoomRequests.find(req => 
        req.useDate === date && 
        req.useTime === period && 
        req.status === 'pending'
    );
    
    if (pendingReservation) {
        if (pendingReservation.requester === currentUser.name && 
            pendingReservation.requesterGrade == currentUser.grade && 
            pendingReservation.requesterClass == currentUser.class) {
            return { status: 'my-reservation', requester: pendingReservation.requester };
        } else {
            const gradeClass = pendingReservation.requesterGrade && pendingReservation.requesterClass ? 
                `${pendingReservation.requesterGrade}-${pendingReservation.requesterClass}` : 
                pendingReservation.requester;
            return { status: 'occupied', requester: gradeClass };
        }
    }
    
    return { status: 'available' };
}

// 시간 슬롯 클릭 처리
let selectedSlot = null;

function handleSlotClick(date, period, time, currentStatus) {
    if (currentStatus === 'my-reservation') {
        // 내 예약 취소 확인
        if (confirm(`${period} (${time}) 예약을 취소하시겠습니까?`)) {
            cancelReservation(date, period);
        }
        return;
    }
    
    // 새 예약
    selectedSlot = { date, period, time };
    
    document.getElementById('modalTitle').textContent = `${period} 예약`;
    document.getElementById('modalSubtitle').textContent = `${date} ${time}에 컴퓨터실을 예약하시겠습니까?`;
    
    const modal = document.getElementById('reservationModal');
    modal.classList.add('active');
}

// 예약 취소
function cancelReservation(date, period) {
    const computerRoomRequests = requests.computerRoom || [];
    const reservationIndex = computerRoomRequests.findIndex(req => 
        req.useDate === date && 
        req.useTime === period && 
        req.requester === currentUser.name && 
        req.requesterGrade == currentUser.grade && 
        req.requesterClass == currentUser.class
    );
    
    if (reservationIndex !== -1) {
        computerRoomRequests.splice(reservationIndex, 1);
        localStorage.setItem('computerRoomRequests', JSON.stringify(computerRoomRequests));
        requests.computerRoom = computerRoomRequests;
        
        alert('예약이 취소되었습니다.');
        updateSchedule();
        updateAdminStats();
    }
}

// 예약 확인 모달 닫기
function closeReservationModal() {
    const modal = document.getElementById('reservationModal');
    modal.classList.remove('active');
    selectedSlot = null;
}

// 예약 확정 (Firebase 지원)
async function confirmReservation() {
    if (!selectedSlot) {
        alert('선택된 시간이 없습니다.');
        return;
    }
    
    // dbManager 안전 접근
    const db = getDbManager();
    
    // 시설별 컬렉션 이름 결정
    const collectionName = currentFacility === 'computer' ? 'computerRoomRequests' : 'tabletRouterRequests';
    
    // 예약 데이터 생성 (자동 승인)
    const reservation = {
        id: Date.now(),
        requester: currentUser.name,
        requesterGrade: currentUser.grade || null,
        requesterClass: currentUser.class || null,
        status: 'approved', // 자동 승인
        submittedAt: new Date().toLocaleString('ko-KR'),
        processedAt: new Date().toLocaleString('ko-KR'), // 바로 처리
        requestDate: new Date().toISOString().split('T')[0],
        useDate: selectedSlot.date,
        useTime: selectedSlot.period,
        facility: currentFacility, // 시설 구분 추가
        schoolName: '두정초등학교' // 학교 구분 추가
    };
    
    try {
        // 데이터베이스에 저장 (Firebase 또는 localStorage)
        await db.addDocument(collectionName, reservation);
        
        // 로컬 requests 객체 즉시 업데이트 (시간표 즉시 반영을 위해)
        if (currentFacility === 'computer') {
            if (!requests.computerRoom) {
                requests.computerRoom = [];
            }
            requests.computerRoom.push(reservation);
            // localStorage도 직접 업데이트
            localStorage.setItem('computerRoomRequests', JSON.stringify(requests.computerRoom));
        } else {
            if (!requests.tabletRouter) {
                requests.tabletRouter = [];
            }
            requests.tabletRouter.push(reservation);
            // localStorage도 직접 업데이트
            localStorage.setItem('tabletRouterRequests', JSON.stringify(requests.tabletRouter));
        }
        
        console.log('✅ 로컬 메모리 및 저장소 업데이트 완료:', reservation);
        
        const facilityName = currentFacility === 'computer' ? '컴퓨터실' : '공유기 (늘봄교실3)';
        const statusMsg = db.isConnected() ? 
            '실시간 데이터베이스에 저장되어 모든 선생님이 확인할 수 있습니다!' : 
            '로컬에 저장되었습니다 (데모 모드)';
        
        alert(`🎉 ${facilityName} 예약이 완료되었습니다!\n\n📅 예약 정보:\n• 날짜: ${selectedSlot.date}\n• 시간: ${selectedSlot.period}\n• 시설: ${facilityName}\n• 상태: 예약 확정\n\n바로 사용 가능합니다!\n\n${statusMsg}`);
        
    } catch (error) {
        console.error('예약 저장 오류:', error);
        alert('❌ 예약 저장 중 오류가 발생했습니다. 다시 시도해주세요.');
        return;
    }
    
    // 모달 닫기
    closeReservationModal();
    
    // 잠시 대기 후 시간표 업데이트 (DOM 업데이트 완료 보장)
    setTimeout(() => {
        const weeklyContainer = document.getElementById('weeklyScheduleContainer');
        if (weeklyContainer) {
            console.log('🔄 주간 시간표 업데이트 시작');
            updateWeeklySchedule();
            console.log('✅ 주간 시간표 업데이트 완료');
        } else {
            console.log('🔄 일반 시간표 업데이트 시작');
            updateSchedule();
            console.log('✅ 일반 시간표 업데이트 완료');
        }
        updateAdminStats();
    }, 100); // 100ms 후 업데이트
}

// 관리자 로그인 폼 표시
function showAdminLogin() {
    document.getElementById('gradeClassForm').style.display = 'none';
    document.getElementById('adminLoginForm').style.display = 'block';
    document.querySelector('p').style.display = 'none';
    document.querySelector('.login-form h2').textContent = '관리자 로그인';
}

// 선생님 로그인 폼으로 돌아가기
function hideAdminLogin() {
    document.getElementById('gradeClassForm').style.display = 'block';
    document.getElementById('adminLoginForm').style.display = 'none';
    document.querySelector('p').style.display = 'block';
    document.querySelector('.login-form h2').textContent = '두정초등학교 시설 관리';
    
    // 관리자 폼 리셋
    document.getElementById('adminForm').reset();
}

// 뒤로가기 - 메뉴로 돌아가기
function goBack() {
    const content = document.querySelector('main');
    
    if (currentUser && currentUser.type === 'teacher') {
        // 현재 주의 예약 상태 확인
        const reservationStatus = getUserReservationStatus(currentUser);
        
        // 예약 상태 표시 텍스트 생성
        const getReservationStatusText = (reservation) => {
            if (!reservation) return '';
            
            const date = new Date(reservation.useDate);
            const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
            const dayName = dayNames[date.getDay()];
            
            return `
                <div class="reservation-status">
                    <span class="status-label">📅 이번 주 예약:</span>
                    <span class="status-info">${date.getMonth() + 1}/${date.getDate()}(${dayName}) ${reservation.useTime}</span>
                </div>
            `;
        };
        
        // 선생님 메뉴 표시
        content.innerHTML = `
            <div class="menu-grid">
                <div class="menu-item ${reservationStatus.computer ? 'has-reservation' : ''}" onclick="openPage('computer-room')">
                    <h3>컴퓨터실 사용 신청</h3>
                    <p>컴퓨터실 사용을 신청합니다</p>
                    ${getReservationStatusText(reservationStatus.computer)}
                </div>
                <div class="menu-item ${reservationStatus.router ? 'has-reservation' : ''}" onclick="openPage('tablet-info')">
                    <h3>태블릿 공유기 정보</h3>
                    <p>태블릿 공유기 정보를 확인합니다</p>
                    ${getReservationStatusText(reservationStatus.router)}
                </div>
                <div class="menu-item" onclick="openPage('science-supplies')">
                    <h3>과학실 준비물 신청</h3>
                    <p>과학실 준비물을 신청합니다</p>
                </div>
                <div class="menu-item" onclick="openPage('maintenance')">
                    <h3>컴퓨터 유지보수 신청</h3>
                    <p>컴퓨터 유지보수를 신청합니다</p>
                </div>
                <div class="menu-item" onclick="openPage('toner')">
                    <h3>토너 신청</h3>
                    <p>토너를 신청합니다</p>
                </div>
            </div>
        `;
    } else if (currentUser && currentUser.type === 'admin') {
        // 관리자 메뉴 표시
        content.innerHTML = `
            <div class="admin-dashboard">
                <h2>관리자 대시보드</h2>
                <div class="dashboard-stats">
                    <div class="stat-item">
                        <h3>대기중인 신청</h3>
                        <span id="pendingRequests">0</span>
                    </div>
                    <div class="stat-item">
                        <h3>오늘 처리된 신청</h3>
                        <span id="todayProcessed">0</span>
                    </div>
                    <div class="stat-item">
                        <h3>전체 신청</h3>
                        <span id="totalRequests">0</span>
                    </div>
                </div>
                
                <div class="admin-menu-grid">
                    <div class="menu-item" onclick="openAdminPage('computer-room-manage')">
                        <h3>컴퓨터실 신청 관리</h3>
                        <p>컴퓨터실 사용 신청을 관리합니다</p>
                    </div>
                    <div class="menu-item" onclick="openAdminPage('tablet-manage')">
                        <h3>태블릿 정보 관리</h3>
                        <p>태블릿 공유기 정보를 관리합니다</p>
                    </div>
                    <div class="menu-item" onclick="openAdminPage('science-manage')">
                        <h3>과학실 준비물 관리</h3>
                        <p>과학실 준비물 신청을 관리합니다</p>
                    </div>
                    <div class="menu-item" onclick="openAdminPage('maintenance-manage')">
                        <h3>유지보수 신청 관리</h3>
                        <p>컴퓨터 유지보수 신청을 관리합니다</p>
                    </div>
                    <div class="menu-item" onclick="openAdminPage('toner-manage')">
                        <h3>토너 신청 관리</h3>
                        <p>토너 신청을 관리합니다</p>
                    </div>
                </div>
            </div>
        `;
        updateAdminStats();
    } else {
        // 로그인 상태가 없으면 새로고침
        location.reload();
    }
}

// 메인 대시보드 업데이트
function updateMainDashboard() {
    // 현재 메인 메뉴가 표시된 상태인지 확인
    const menuGrid = document.querySelector('.menu-grid');
    if (menuGrid && currentUser && currentUser.type === 'teacher') {
        console.log('📊 메인 대시보드 예약 상태 업데이트');
        goBack(); // 메뉴를 다시 그려서 최신 예약 상태 반영
    }
}