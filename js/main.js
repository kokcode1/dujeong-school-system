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

// 자동 로그인 체크
function checkAutoLogin() {
    // 학교 비밀번호 확인
    const isPasswordVerified = localStorage.getItem('schoolPasswordVerified') === 'true';
    // 저장된 선생님 정보 확인
    const savedTeacherInfo = localStorage.getItem('savedTeacherInfo');
    
    if (isPasswordVerified && savedTeacherInfo) {
        try {
            const teacherInfo = JSON.parse(savedTeacherInfo);
            // 자동 로그인 수행
            currentUser = generateTeacherFromGradeClass(teacherInfo.grade, teacherInfo.class);
            return true;
        } catch (e) {
            // 저장된 정보가 손상된 경우 학년/반 정보만 제거
            localStorage.removeItem('savedTeacherInfo');
        }
    }
    return false;
}

// 과거 날짜 선택 방지 함수
function setMinDateToToday() {
    const today = new Date().toISOString().split('T')[0];
    
    // DOM이 완전히 로드될 때까지 기다림
    setTimeout(() => {
        const dateInputs = document.querySelectorAll('input[type="date"]');
        console.log('📅 날짜 입력 필드 개수:', dateInputs.length);
        
        dateInputs.forEach((input, index) => {
            input.setAttribute('min', today);
            input.setAttribute('value', today); // 기본값도 오늘로 설정
            console.log(`📅 ${index + 1}번 필드 최소값 설정:`, today);
        });
    }, 100);
}

// 저장된 세션 확인 및 복원 (기존 함수 - 호환성 유지)
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
    tabletRouter: JSON.parse(localStorage.getItem('tabletRouterRequests') || '[]'),
    library: JSON.parse(localStorage.getItem('libraryRequests') || '[]')
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
        
        // 자동 로그인 체크
        if (checkAutoLogin()) {
            showUserSection();
            return; // 자동 로그인 성공 시 로그인 화면 건너뜀
        }
        
        // 학교 비밀번호가 이미 인증된 경우 학년/반 선택으로 바로 이동
        const isPasswordVerified = localStorage.getItem('schoolPasswordVerified') === 'true';
        if (isPasswordVerified) {
            document.getElementById('schoolPasswordForm').style.display = 'none';
            document.getElementById('gradeClassForm').style.display = 'block';
            document.getElementById('loginDescription').textContent = '담임하시는 학년과 반을 선택해주세요';
        }
        
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
        
        // 실시간 리스너 설정
        setupRealtimeListeners();
        
        // 페이지 포커스 동기화 설정
        db.setupPageFocusSync();
        
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
        console.log('🔄 Firebase에서 컴퓨터실 예약 데이터 수신:', {
            count: data.length,
            data: data.map(d => ({ 
                id: d.id, 
                firestoreId: d.firestoreId,
                useDate: d.useDate, 
                useTime: d.useTime, 
                requester: d.requester,
                requesterGrade: d.requesterGrade,
                requesterClass: d.requesterClass
            }))
        });
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
    
    // 도서관 예약 실시간 감지
    db.setupRealtimeListener('libraryRequests', (data) => {
        requests.library = data;
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

// Firestore에서 업데이트 시 호출되는 함수
window.updateFromFirestore = function(collectionName) {
    console.log(`🔄 UI 업데이트: ${collectionName}`);
    
    const db = getDbManager();
    if (!db || !db.cache[collectionName]) return;
    
    const data = db.cache[collectionName];
    
    // requests 객체 업데이트
    const requestType = collectionName.replace('Requests', '');
    if (requestType === 'computerRoom') {
        requests.computerRoom = data;
    } else if (requestType === 'tabletRouter') {
        requests.tabletRouter = data;
    } else if (requestType === 'library') {
        requests.library = data;
    } else {
        requests[requestType] = data;
    }
    
    // UI 업데이트
    if (document.getElementById('weeklyScheduleContainer')) {
        updateWeeklySchedule();
    }
    updateAdminStats();
    updateMainDashboard();
    
    console.log(`✅ UI 업데이트 완료: ${collectionName} (${data.length}개)`);
};

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
    
    // 선택된 학년/반 버튼 초기화
    const gradeButtons = document.querySelectorAll('.grade-btn');
    const classButtons = document.querySelectorAll('.class-btn');
    
    gradeButtons.forEach(btn => btn.classList.remove('selected'));
    classButtons.forEach(btn => btn.classList.remove('selected'));
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

// 학교 비밀번호 검증
function verifySchoolPassword() {
    const password = document.getElementById('schoolPassword').value;
    const SCHOOL_PASSWORD = '9581'; // 학교 비밀번호
    
    if (password === SCHOOL_PASSWORD) {
        // 학교 비밀번호 저장
        localStorage.setItem('schoolPasswordVerified', 'true');
        
        // UI 전환
        document.getElementById('schoolPasswordForm').style.display = 'none';
        document.getElementById('gradeClassForm').style.display = 'block';
        document.getElementById('loginDescription').textContent = '담임하시는 학년과 반을 선택해주세요';
    } else {
        alert('학교 비밀번호가 올바르지 않습니다.');
    }
}

// 선생님으로 로그인
function loginAsTeacher(grade, classNum) {
    // 선생님 정보 생성
    currentUser = generateTeacherFromGradeClass(grade, classNum);
    
    // 학년/반 정보 저장
    const teacherInfo = {
        grade: grade,
        class: classNum,
        loginDate: new Date().toISOString()
    };
    localStorage.setItem('savedTeacherInfo', JSON.stringify(teacherInfo));
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    
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
    document.getElementById('userName').textContent = currentUser.name;
    
    if (currentUser.type === 'teacher') {
        document.getElementById('teacherSection').style.display = 'block';
        document.getElementById('adminSection').style.display = 'none';
        // 선생님 메뉴와 예약 위젯을 바로 표시
        goBack();
    } else if (currentUser.type === 'admin') {
        document.getElementById('adminSection').style.display = 'block';
        document.getElementById('teacherSection').style.display = 'none';
        updateAdminStats();
        // 관리자 메뉴를 바로 표시
        goBack();
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
    // 학교 비밀번호는 유지, 학년/반 정보만 제거
    localStorage.removeItem('savedTeacherInfo'); // 학년/반 정보만 제거
    // localStorage.removeItem('schoolPasswordVerified'); // 학교 비밀번호는 유지
    
    // 기존 세션 제거
    localStorage.removeItem('currentUser');
    localStorage.removeItem('teacherSession');
    
    // UI 상태 복구
    const loginSection = document.getElementById('loginSection');
    const userInfo = document.getElementById('userInfo');
    const teacherSection = document.getElementById('teacherSection');
    const adminSection = document.getElementById('adminSection');
    const main = document.querySelector('main');
    
    // 모든 섹션 숨기기
    if (teacherSection) teacherSection.style.display = 'none';
    if (adminSection) adminSection.style.display = 'none';
    if (userInfo) userInfo.style.display = 'none';
    
    // main 컨테이너 클리어 (동적으로 생성된 내용 제거)
    if (main) {
        main.innerHTML = '';
    }
    
    // 로그인 섹션 표시
    if (loginSection) loginSection.style.display = 'block';
    
    // 관리자 폼 초기화 (존재할 경우)
    const adminForm = document.getElementById('adminForm');
    if (adminForm) {
        adminForm.reset();
    }
    
    // 로그아웃 시 항상 학년/반 선택 화면으로 (학교 비밀번호는 이미 저장되어 있음)
    document.getElementById('schoolPasswordForm').style.display = 'none';
    document.getElementById('gradeClassForm').style.display = 'block';
    document.getElementById('loginDescription').textContent = '담임하시는 학년과 반을 선택해주세요';
    
    // 학년/반 선택 상태 초기화
    showGradeSelection();
    
    console.log('✅ 로그아웃 완료');
}

// 업데이트 예정 메시지 표시
function showUpdateMessage(feature) {
    const messages = {
        'science-supplies': '과학실 준비물 신청'
    };
    
    const featureName = messages[feature] || '해당 기능';
    alert(`${featureName} 기능은 현재 업데이트 중입니다.\n곧 새로운 기능으로 찾아뵙겠습니다! 🚀`);
}

// 페이지 열기 (선생님)
function openPage(page) {
    const content = document.querySelector('main');
    
    switch(page) {
        case 'computer-room':
            showComputerRoomForm();
            break;
        case 'router':
            showRouterForm();
            break;
        case 'library':
            showLibraryForm();
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
    },
    library: {
        '월': { '1교시': '4', '2교시': '4', '3교시': '4', '4교시': '사서도우미', '5교시': '4', '6교시': '6' },
        '화': { '1교시': '3', '2교시': '3', '3교시': '3', '4교시': '사서도우미', '5교시': '3', '6교시': '6' },
        '수': { '1교시': '5', '2교시': '5', '3교시': '5', '4교시': '사서도우미', '5교시': '5', '6교시': '6' },
        '목': { '1교시': '2', '2교시': '2', '3교시': '2', '4교시': '사서도우미', '5교시': '2', '6교시': '6' },
        '금': { '1교시': '1', '2교시': '1', '3교시': '1', '4교시': '사서도우미', '5교시': '1', '6교시': '6' }
    }
};

let currentFacility = 'computer'; // 'computer', 'router', 또는 'library'
let currentWeekStart = null;

// 주간 예약 제한 (개인당 시설별 2회)
const WEEKLY_RESERVATION_LIMIT = 2;

// 현재 주의 사용자 예약 상태 확인
function getUserReservationStatus(userInfo) {
    if (!userInfo) return { computer: [], router: [], library: [] };
    
    const today = new Date();
    const thisMonday = new Date(today);
    thisMonday.setDate(today.getDate() - today.getDay() + 1); // 이번주 월요일
    
    // 이번주 월요일부터 다음주 금요일까지 (학교 수업일만)
    const thisWeekStart = new Date(thisMonday); // 월요일 시작
    const twoWeeksEnd = new Date(thisMonday);
    twoWeeksEnd.setDate(thisMonday.getDate() + 11); // 다음주 금요일까지
    
    const weekStartStr = thisWeekStart.toISOString().split('T')[0]; // 월요일부터
    const twoWeeksEndStr = twoWeeksEnd.toISOString().split('T')[0];
    
    console.log('📅 주간 범위 계산:', {
        today: today.toISOString().split('T')[0],
        weekStart: weekStartStr,
        twoWeeksEnd: twoWeeksEndStr,
        userInfo: userInfo
    });
    
    // 컴퓨터실 예약 확인 (이번주+다음주)
    console.log('🔍 전체 컴퓨터실 예약 데이터:', requests.computerRoom);
    
    const computerReservations = (requests.computerRoom || []).filter(req => {
        const matchesDate = req.useDate >= weekStartStr && req.useDate <= twoWeeksEndStr;
        const matchesUser = req.requester === userInfo.name;
        const matchesGrade = req.requesterGrade == userInfo.grade;
        const matchesClass = req.requesterClass == userInfo.class;
        const matchesStatus = req.status === 'approved' || req.status === 'pending';
        
        console.log('🔍 예약 매칭 체크:', {
            reservation: {
                useDate: req.useDate,
                requester: req.requester,
                requesterGrade: req.requesterGrade,
                requesterClass: req.requesterClass,
                status: req.status
            },
            currentUser: {
                name: userInfo.name,
                grade: userInfo.grade,
                class: userInfo.class
            },
            matches: {
                date: `${req.useDate} 범위: ${weekStartStr} ~ ${twoWeeksEndStr} = ${matchesDate}`,
                user: `${req.requester} === ${userInfo.name} = ${matchesUser}`,
                grade: `${req.requesterGrade} == ${userInfo.grade} = ${matchesGrade}`,
                class: `${req.requesterClass} == ${userInfo.class} = ${matchesClass}`,
                status: `${req.status} in [approved,pending] = ${matchesStatus}`
            },
            finalMatch: matchesDate && matchesUser && matchesGrade && matchesClass && matchesStatus
        });
        
        return matchesDate && matchesUser && matchesGrade && matchesClass && matchesStatus;
    });
    
    // 공유기 예약 확인 (이번주+다음주)
    const routerReservations = (requests.tabletRouter || []).filter(req => {
        const matchesDate = req.useDate >= weekStartStr && req.useDate <= twoWeeksEndStr;
        const matchesUser = req.requester === userInfo.name;
        const matchesGrade = req.requesterGrade == userInfo.grade;
        const matchesClass = req.requesterClass == userInfo.class;
        const matchesStatus = req.status === 'approved' || req.status === 'pending';
        
        return matchesDate && matchesUser && matchesGrade && matchesClass && matchesStatus;
    });
    
    // 도서관 예약 확인 (이번주+다음주)
    const libraryReservations = (requests.library || []).filter(req => {
        const matchesDate = req.useDate >= weekStartStr && req.useDate <= twoWeeksEndStr;
        const matchesUser = req.requester === userInfo.name;
        const matchesGrade = req.requesterGrade == userInfo.grade;
        const matchesClass = req.requesterClass == userInfo.class;
        const matchesStatus = req.status === 'approved' || req.status === 'pending';
        
        return matchesDate && matchesUser && matchesGrade && matchesClass && matchesStatus;
    });
    
    console.log('✅ 최종 예약 상태:', {
        computer: computerReservations,
        router: routerReservations,
        library: libraryReservations
    });
    
    console.log('🔍 도서관 예약 디버깅:', {
        totalLibraryRequests: requests.library?.length || 0,
        filteredLibraryReservations: libraryReservations.length,
        sampleLibraryRequest: requests.library?.[0],
        userInfo: userInfo
    });
    
    return {
        computer: computerReservations,
        router: routerReservations,
        library: libraryReservations
    };
}

// 특정 주간의 개인 예약 횟수 확인
function getWeeklyReservationCount(weekStart, facility, userInfo) {
    const facilityRequests = facility === 'computer' ? 
        (requests.computerRoom || []) : 
        facility === 'router' ? 
        (requests.tabletRouter || []) :
        (requests.library || []);
    
    // 주간 범위 계산 (월요일부터 금요일까지)
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 4); // 금요일까지
    
    const weekStartStr = weekStart.toISOString().split('T')[0];
    const weekEndStr = weekEnd.toISOString().split('T')[0];
    
    // 해당 주간의 개인 예약 개수 세기 (다른 학년 협의 예약 제외)
    const userReservations = facilityRequests.filter(req => 
        req.useDate >= weekStartStr && 
        req.useDate <= weekEndStr &&
        req.requester === userInfo.name &&
        req.requesterGrade == userInfo.grade &&
        req.requesterClass == userInfo.class &&
        (req.status === 'approved' || req.status === 'pending') &&
        !req.crossGradeReservation  // 협의 예약은 횟수에서 제외
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
    const facilityName = facility === 'computer' ? '컴퓨터실' : 
                         facility === 'router' ? '공유기' : '도서관';
    
    if (currentCount >= WEEKLY_RESERVATION_LIMIT) {
        alert(`⚠️ ${facilityName} 주간 사용 제한\n\n개인당 1주일에 최대 2번까지 예약 가능합니다.\n현재 이번 주 사용 횟수: ${currentCount}/${WEEKLY_RESERVATION_LIMIT}\n\n기존 예약을 취소한 후 다시 시도해주세요.`);
        return false;
    }
    
    return true;
}

// 공유기실 신청 폼 - 주간 시간표 형태
function showRouterForm() {
    const content = document.querySelector('main');
    
    content.innerHTML = `
        <button onclick="goBack()" class="back-btn">← 돌아가기</button>
        <div class="schedule-container">
            <h2 style="text-align: center; color: #2d3748; margin-bottom: 1.5rem; font-size: 1.75rem; font-weight: 600;">공유기실 사용 신청</h2>
            
            <div class="usage-guide">
                💡 요일 + 교시 클릭 → 예약 | 주당 최대 2회<br>
                • 다른 학년 예약 시 해당 학년 선생님과 협의 후 사용<br>
                • 내 예약(주황색) 다시 클릭 시 취소 가능
            </div>
            
            <div class="date-selector">
                <label>주차 선택:</label>
                <div class="week-buttons">
                    <button id="thisWeekBtn" class="week-btn active" onclick="selectWeek('this')">이번주</button>
                    <button id="nextWeekBtn" class="week-btn" onclick="selectWeek('next')">다음주</button>
                </div>
            </div>
            
            <div class="usage-guide">
                💡 초록(예약가능) | 빨강(예약됨) | 파랑/주황/초록(내예약) | 노랑(우리학년) | 회색(다른학년)
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
            
            <div id="weeklyScheduleContainer"></div>
        </div>
        
        <!-- 예약 모달 -->
        <div id="reservationModal" class="reservation-modal">
            <div class="modal-content">
                <div class="modal-header">
                    <h3 id="modalTitle"></h3>
                    <p id="modalSubtitle"></p>
                </div>
                <div class="modal-actions">
                    <button onclick="confirmReservation()" class="modal-btn primary">예약하기</button>
                    <button onclick="closeModal()" class="modal-btn secondary">취소</button>
                </div>
            </div>
        </div>
    `;
    
    // 공유기실로 설정
    currentFacility = 'router';
    
    // 주차 선택기 초기화 및 시간표 표시
    initializeWeekSelector();
    updateWeeklySchedule();
}

// 컴퓨터실 신청 폼 - 주간 시간표 형태
function showComputerRoomForm() {
    const content = document.querySelector('main');
    
    content.innerHTML = `
        <button onclick="goBack()" class="back-btn">← 돌아가기</button>
        <div class="schedule-container">
            <h2 style="text-align: center; color: #2d3748; margin-bottom: 1.5rem; font-size: 1.75rem; font-weight: 600;">컴퓨터실 사용 신청</h2>
            
            <div class="usage-guide">
                💡 요일 + 교시 클릭 → 예약 | 주당 최대 2회<br>
                • 다른 학년 예약 시 해당 학년 선생님과 협의 후 사용<br>
                • 내 예약(파란색) 다시 클릭 시 취소 가능
            </div>
            
            <div class="date-selector">
                <label>주차 선택:</label>
                <div class="week-buttons">
                    <button id="thisWeekBtn" class="week-btn active" onclick="selectWeek('this')">이번주</button>
                    <button id="nextWeekBtn" class="week-btn" onclick="selectWeek('next')">다음주</button>
                </div>
            </div>
            
            <div class="usage-guide">
                💡 초록(예약가능) | 빨강(예약됨) | 파랑/주황/초록(내예약) | 노랑(우리학년) | 회색(다른학년)
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
    
    // 컴퓨터실로 시설 변경
    currentFacility = 'computer';
    
    // 현재 주차로 초기화
    initializeWeekSelector();
    updateWeeklySchedule();
}

// 태블릿 정보 보기
function showLibraryForm() {
    const content = document.querySelector('main');
    
    content.innerHTML = `
        <button onclick="goBack()" class="back-btn">← 돌아가기</button>
        <div class="schedule-container">
            <h2 style="text-align: center; color: #2d3748; margin-bottom: 1.5rem; font-size: 1.75rem; font-weight: 600;">도서관 이용 신청</h2>
            
            <div class="usage-guide">
                💡 요일 + 교시 클릭 → 예약 | 학년별 이용시간 다름<br>
                • 다른 학년 예약 시 해당 학년 선생님과 협의 후 사용<br>
                • 내 예약(초록색) 다시 클릭 시 취소 가능
            </div>
            
            <div class="date-selector">
                <label>주차 선택:</label>
                <div class="week-buttons">
                    <button id="thisWeekBtn" class="week-btn active" onclick="selectWeek('this')">이번주</button>
                    <button id="nextWeekBtn" class="week-btn" onclick="selectWeek('next')">다음주</button>
                </div>
            </div>
            
            <div class="usage-guide">
                💡 초록(예약가능) | 빨강(예약됨) | 파랑/주황/초록(내예약) | 노랑(우리학년) | 회색(다른학년)
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
                    <div class="legend-color legend-my-reservation"></div>
                    <span>내 예약</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color legend-assigned"></div>
                    <span>학년 전용</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color legend-other-grade"></div>
                    <span>다른 학년</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color legend-disabled"></div>
                    <span>사서도우미 시간</span>
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
                    <h3 id="modalTitle">도서관 예약</h3>
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
    
    // 도서관으로 시설 변경
    currentFacility = 'library';
    
    // 현재 주차로 초기화
    initializeWeekSelector();
    updateWeeklySchedule();
}

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
    const today = new Date().toISOString().split('T')[0];
    const content = document.querySelector('main');
    content.innerHTML = `
        <button onclick="goBack()" class="back-btn">← 돌아가기</button>
        <div class="request-form">
            <h2>과학실 준비물 신청</h2>
            <form id="scienceForm">
                <div class="form-group">
                    <label for="requestDate">신청일:</label>
                    <input type="date" id="requestDate" name="requestDate" min="${today}" required>
                </div>
                <div class="form-group">
                    <label for="needDate">필요일:</label>
                    <input type="date" id="needDate" name="needDate" min="${today}" required>
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
    
    // 과거 날짜 선택 방지
    setMinDateToToday();
    
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
    const today = new Date().toISOString().split('T')[0];
    const content = document.querySelector('main');
    content.innerHTML = `
        <button onclick="goBack()" class="back-btn">← 돌아가기</button>
        <div class="request-form">
            <h2>컴퓨터 유지보수 신청</h2>
            <form id="maintenanceForm">
                <div class="form-group">
                    <label for="requestDate">신청일:</label>
                    <input type="date" id="requestDate" name="requestDate" min="${today}" required>
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
    
    // 과거 날짜 선택 방지
    setMinDateToToday();
    
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
    const today = new Date().toISOString().split('T')[0];
    const content = document.querySelector('main');
    content.innerHTML = `
        <button onclick="goBack()" class="back-btn">← 돌아가기</button>
        <div class="request-form">
            <h2>토너 신청</h2>
            <form id="tonerForm">
                <div class="form-group">
                    <label for="requestDate">신청일:</label>
                    <input type="date" id="requestDate" name="requestDate" min="${today}" required>
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
    
    // 과거 날짜 선택 방지
    setMinDateToToday();
    
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
    
    // 과거 날짜 선택 방지
    setMinDateToToday();
    
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
// switchFacility 함수는 더 이상 사용하지 않음 (각 시설별 전용 페이지로 분리)
// function switchFacility(facility) {
//     currentFacility = facility;
//     
//     // 탭 활성화 상태 변경
//     document.querySelectorAll('.facility-tab').forEach(tab => {
//         tab.classList.remove('active');
//     });
//     event.target.classList.add('active');
//     
//     console.log(`🔄 시설 전환: ${facility}`);
//     
//     // 시간표 업데이트 (제한 상태 재계산 포함)
//     updateWeeklySchedule();
// }

// 주차 선택기 초기화
function initializeWeekSelector() {
    const thisWeekBtn = document.getElementById('thisWeekBtn');
    const nextWeekBtn = document.getElementById('nextWeekBtn');
    
    if (!thisWeekBtn || !nextWeekBtn) {
        console.error('주차 버튼을 찾을 수 없습니다.');
        return;
    }
    
    const today = new Date();
    
    // 간단한 이번주 월요일 계산
    const thisMonday = new Date(today);
    thisMonday.setDate(today.getDate() - today.getDay() + 1);
    
    // 다음 주의 월요일 구하기
    const nextMonday = new Date(thisMonday);
    nextMonday.setDate(thisMonday.getDate() + 7);
    
    // 버튼 텍스트 업데이트 (날짜 포함)
    thisWeekBtn.textContent = `이번주 (${thisMonday.getMonth() + 1}/${thisMonday.getDate()})`;
    nextWeekBtn.textContent = `다음주 (${nextMonday.getMonth() + 1}/${nextMonday.getDate()})`;
    
    // 기본값 설정 (이번 주)
    currentWeekStart = new Date(thisMonday);
    window.currentWeekMode = 'this'; // 현재 선택된 주 저장
    
    console.log('📅 컴퓨터실 주차 버튼 초기화:', thisMonday.toISOString().split('T')[0]);
    console.log('🗓️ 다음주 신청 가능 여부: 항상 가능');
}

// 주차 선택 함수 (버튼용)
function selectWeek(weekType) {
    const thisWeekBtn = document.getElementById('thisWeekBtn');
    const nextWeekBtn = document.getElementById('nextWeekBtn');
    
    // 버튼 상태 업데이트
    thisWeekBtn.classList.remove('active');
    nextWeekBtn.classList.remove('active');
    
    const today = new Date();
    
    // 간단한 이번주 월요일 계산
    const thisMonday = new Date(today);
    thisMonday.setDate(today.getDate() - today.getDay() + 1);
    
    if (weekType === 'this') {
        thisWeekBtn.classList.add('active');
        currentWeekStart = new Date(thisMonday);
        window.currentWeekMode = 'this';
        console.log('📅 이번주 선택:', thisMonday.toISOString().split('T')[0]);
    } else if (weekType === 'next') {
        nextWeekBtn.classList.add('active');
        const nextMonday = new Date(thisMonday);
        nextMonday.setDate(thisMonday.getDate() + 7);
        currentWeekStart = new Date(nextMonday);
        window.currentWeekMode = 'next';
        console.log('📅 다음주 선택:', nextMonday.toISOString().split('T')[0]);
    }
    
    // 시간표 업데이트
    updateWeeklySchedule();
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
    const container = document.getElementById('weeklyScheduleContainer');
    
    if (!container) {
        console.error('주간 시간표 컨테이너를 찾을 수 없습니다.');
        return;
    }
    
    if (!currentWeekStart) {
        console.log('주차가 선택되지 않았습니다.');
        return;
    }
    
    try {
        const scheduleTable = generateWeeklyScheduleTable();
        container.innerHTML = scheduleTable;
        
        const weekMode = window.currentWeekMode || 'this';
        console.log('📅 주간 시간표 업데이트 완료:', weekMode === 'this' ? '이번주' : '다음주');
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
    // 학년별/시설별 차등 시간표 적용
    function getPeriodsForGrade(grade) {
        const basePeriods = [
            { name: '1교시', time: '08:50-09:30' },
            { name: '2교시', time: currentFacility === 'library' ? '09:30-10:20' : '09:40-10:20' },
            { name: '3교시', time: '10:40-11:20' }
        ];
        
        if (currentFacility === 'library') {
            // 도서관: 학년별 차등 시간표 (컴퓨터실과 동일한 방식)
            if (grade <= 3) {
                // 1,2,3학년 (저학년)
                basePeriods.push(
                    { name: '4교시', time: '12:30-13:10' },
                    { name: '5교시', time: '13:20-14:00' },
                    { name: '6교시', time: '14:10-14:50' }
                );
            } else {
                // 4,5,6학년 (고학년)
                basePeriods.push(
                    { name: '4교시', time: '11:30-12:10' },
                    { name: '5교시', time: '13:20-14:00' },
                    { name: '6교시', time: '14:10-14:50' }
                );
            }
        } else {
            // 컴퓨터실/공유기: 기존 로직
            if (grade <= 3) {
                // 1,2,3학년
                basePeriods.push(
                    { name: '4교시', time: '12:30-13:10' },
                    { name: '5교시', time: '13:20-14:00' }
                );
            } else {
                // 4,5,6학년
                basePeriods.push(
                    { name: '4교시', time: '11:30-12:10' },
                    { name: '5교시', time: '13:20-14:00' },
                    { name: '6교시', time: '14:10-14:50' }
                );
            }
        }
        
        return basePeriods;
    }
    
    const periods = getPeriodsForGrade(currentUser.grade);
    
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
            // 컴퓨터실: 수요일 6교시 제거 (4-6학년만)
            if (currentFacility === 'computer' && day === '수' && period.name === '6교시' && currentUser.grade > 3) {
                tableHTML += `
                    <td>
                        <button class="schedule-cell disabled">
                            수업없음
                        </button>
                    </td>
                `;
                return;
            }
            
            const date = new Date(currentWeekStart);
            date.setDate(currentWeekStart.getDate() + dayIndex);
            const dateStr = date.toISOString().split('T')[0];
            
            // 과거 날짜 확인 (오늘은 예약 가능, 어제까지만 과거)
            const todayStr = new Date().toISOString().split('T')[0];
            const isPastDate = dateStr < todayStr;
            
            // 디버깅 로그 (첫 번째 셀에서만)
            if (dayIndex === 0 && periodIndex === 0) {
                const realToday = new Date();
                console.log('🗓️ 날짜 비교 최종:', {
                    cellDate: dateStr,
                    today: todayStr,
                    isPastDate: isPastDate,
                    comparison: `'${dateStr}' < '${todayStr}' = ${isPastDate}`
                });
            }
            
            const cellStatus = getWeeklyCellStatus(day, period.name, dateStr);
            let cellClass = cellStatus.status;
            let cellData = cellStatus.grade ? `data-grade="${cellStatus.grade}"` : '';
            let onClick = '';
            let displayText = cellStatus.content || '';
            
            // 과거 날짜인 경우 비활성화
            if (isPastDate) {
                cellClass = 'past-date';
                onClick = '';
                displayText = '지난일';
            } else {
                onClick = cellStatus.clickable ? 
                    `onclick="handleWeeklyCellClick('${dateStr}', '${period.name}', '${period.time}', '${day}', '${cellClass}')"` : 
                    (cellClass === 'default-assigned' ? `onclick="showCrossGradeConfirmation('${dateStr}', '${period.name}', '${period.time}', '${day}')"` : '');
            }
            
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
        currentFacility === 'router' ?
        (requests.tabletRouter || []) :
        (requests.library || []);
    
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
            // 협의 예약인지 확인
            const displayText = existingReservation.crossGradeReservation ? '내 예약(협의)' : '내 예약';
            return { 
                status: 'my-reservation', 
                content: displayText,
                clickable: true 
            };
        } else {
            console.log(`❌ 다른 사람 예약`);
            // 협의 예약인 경우 displayName 사용, 아니면 기존 로직
            const displayText = existingReservation.crossGradeReservation && existingReservation.displayName ? 
                existingReservation.displayName : 
                (existingReservation.requesterGrade && existingReservation.requesterClass ? 
                    `${existingReservation.requesterGrade}-${existingReservation.requesterClass}` : 
                    existingReservation.requester);
            return { 
                status: 'occupied', 
                content: displayText,
                clickable: false 
            };
        }
    }
    
    // 기본 배정 확인 (예약이 없을 때만)
    const dayAssignments = defaultAssignments[currentFacility][day];
    const assignedGrade = dayAssignments ? dayAssignments[period] : null;
    
    if (assignedGrade) {
        // 사서도우미 시간 처리 (도서관만)
        if (currentFacility === 'library' && assignedGrade === '사서도우미') {
            return {
                status: 'disabled',
                content: '사서도우미 근무시간',
                clickable: false
            };
        }
        
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
    
    if (currentStatus === 'disabled') {
        alert('이 시간은 사서도우미 근무시간입니다.');
        return;
    }
    
    // 현재 예약 개수 확인
    const currentCount = getWeeklyReservationCount(currentWeekStart, currentFacility, currentUser);
    
    // 2번째 예약부터는 같은 학년 시간대에서 다른 선생님 허락 확인
    if (currentCount >= 1 && currentStatus === 'assigned-available') {
        const confirmed = confirm('이미 이번 주에 정해진 시간에 예약이 1번 되었습니다.\n\n같은 학년 다른 선생님께 허락받으셨나요?\n\n"확인"을 누르면 예약이 진행됩니다.');
        if (!confirmed) {
            return; // 취소 시 예약 중단
        }
    }
    
    // 기존 주간 제한 체크 (3번 이상은 막기)
    if (currentCount >= 2) {
        alert(`⚠️ ${currentFacility === 'computer' ? '컴퓨터실' : currentFacility === 'router' ? '공유기' : '도서관'} 주간 사용 제한\n\n개인당 1주일에 최대 2번까지만 예약 가능합니다.\n현재 이번 주 사용 횟수: ${currentCount}/2\n\n기존 예약을 취소한 후 다시 시도해주세요.`);
        return;
    }
    
    selectedSlot = { date, period, time, day };
    
    const facilityName = currentFacility === 'computer' ? '컴퓨터실' : 
                         currentFacility === 'router' ? '공유기 (늘봄교실3)' : '도서관';
    
    document.getElementById('modalTitle').textContent = `${facilityName} ${period} 예약`;
    document.getElementById('modalSubtitle').textContent = `${date} (${day}요일) ${time}에 ${facilityName}을 예약하시겠습니까?\n\n📊 이번 주 사용 현황: ${currentCount}/${WEEKLY_RESERVATION_LIMIT}회`;
    
    const modal = document.getElementById('reservationModal');
    modal.classList.add('active');
}

// 주간 예약 취소
async function cancelWeeklyReservation(date, period) {
    const facilityType = currentFacility === 'computer' ? 'computerRoom' : 'tabletRouter';
    const collectionName = currentFacility === 'computer' ? 'computerRoomRequests' : 
                          currentFacility === 'router' ? 'tabletRouterRequests' : 'libraryRequests';
    const storageKey = currentFacility === 'computer' ? 'computerRoomRequests' : 
                      currentFacility === 'router' ? 'tabletRouterRequests' : 'libraryRequests';
    const facilityRequests = currentFacility === 'computer' ? 
        (requests.computerRoom || []) : 
        currentFacility === 'router' ?
        (requests.tabletRouter || []) :
        (requests.library || []);
    
    const reservation = facilityRequests.find(req => 
        req.useDate === date && 
        req.useTime === period && 
        req.requester === currentUser.name && 
        req.requesterGrade == currentUser.grade && 
        req.requesterClass == currentUser.class
    );
    
    if (reservation) {
        // Firebase에서 삭제 (id가 있는 경우)
        if (reservation.firestoreId) {
            const db = getDbManager();
            if (db && db.isConnected()) {
                try {
                    await db.deleteDocument(collectionName, reservation.firestoreId);
                    console.log(`🗑️ Firebase에서 ${facilityType} 예약 삭제됨:`, reservation.firestoreId);
                } catch (error) {
                    console.error('❌ Firebase 삭제 오류:', error);
                }
            }
        }
        
        // localStorage에서 삭제
        const reservationIndex = facilityRequests.findIndex(req => req === reservation);
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
        updateMainDashboard(); // 메인 대시보드 업데이트
    }
}

// 시간표 업데이트 (기존 함수 - 호환성을 위해 유지)
function updateSchedule() {
    const selectedDate = document.getElementById('scheduleDate').value;
    const scheduleGrid = document.getElementById('scheduleGrid');
    
    // 학년별 차등 시간표 적용
    function getTimeSlots(grade, dayOfWeek) {
        const baseSlots = [
            { period: '1교시', time: '08:50-09:30' },
            { period: '2교시', time: currentFacility === 'library' ? '09:30-10:20' : '09:40-10:20' },
            { period: '3교시', time: '10:40-11:20' }
        ];
        
        // 4-6교시는 학년별로 다름
        if (grade <= 3) {
            // 1,2,3학년
            baseSlots.push(
                { period: '4교시', time: '12:30-13:10' },
                { period: '5교시', time: '13:20-14:00' }
            );
        } else {
            // 4,5,6학년
            baseSlots.push(
                { period: '4교시', time: '11:30-12:10' },
                { period: '5교시', time: '13:20-14:00' },
                { period: '6교시', time: '14:10-14:50' }
            );
        }
        
        // 컴퓨터실: 수요일은 6교시 제외
        if (currentFacility === 'computer' && dayOfWeek === 3 && grade > 3) { // 수요일(3)이고 4-6학년인 경우
            return baseSlots.slice(0, 5); // 6교시 제거
        }
        
        // 도서관: 정확한 4교시 시간 적용
        if (currentFacility === 'library') {
            if (grade <= 3) {
                // 1,2,3학년: 저학년 4교시 시간
                baseSlots[3] = { period: '4교시', time: '12:30-13:10' };
            } else {
                // 4,5,6학년: 고학년 4교시 시간
                baseSlots[3] = { period: '4교시', time: '11:30-12:10' };
            }
            // 모든 학년에 6교시 추가
            if (baseSlots.length < 6) {
                baseSlots.push({ period: '6교시', time: '14:10-14:50' });
            }
        }
        
        return baseSlots;
    }
    
    const timeSlots = getTimeSlots(currentUser.grade, new Date(date).getDay());
    
    let gridHTML = '';
    
    timeSlots.forEach(slot => {
        const slotStatus = getSlotStatus(selectedDate, slot.period);
        const statusClass = slotStatus.status;
        const isClickable = statusClass === 'available' || statusClass === 'my-reservation';
        const onClick = isClickable ? 
            `onclick="handleSlotClick('${selectedDate}', '${slot.period}', '${slot.time}', '${statusClass}')"` : 
            (statusClass === 'other-grade' ? `onclick="showCrossGradeConfirmation('${selectedDate}', '${slot.period}', '${slot.time}', '')"` : '');
        
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
    const facilityRequests = currentFacility === 'computer' ? 
        (requests.computerRoom || []) : 
        currentFacility === 'router' ?
        (requests.tabletRouter || []) :
        (requests.library || []);
    
    // 선택된 날짜와 시간에 해당하는 승인된 예약 찾기
    const existingReservation = facilityRequests.find(req => 
        req.useDate === date && 
        req.useTime === period && 
        req.status === 'approved'
    );
    
    if (existingReservation) {
        // 내 예약인지 확인
        if (existingReservation.requester === currentUser.name && 
            existingReservation.requesterGrade == currentUser.grade && 
            existingReservation.requesterClass == currentUser.class) {
            // 협의 예약인지 확인
            const displayText = existingReservation.crossGradeReservation ? '내 예약(협의)' : '내 예약';
            return { status: 'my-reservation', requester: displayText };
        } else {
            // 협의 예약인 경우 displayName 사용, 아니면 기존 로직
            const displayText = existingReservation.crossGradeReservation && existingReservation.displayName ? 
                existingReservation.displayName : 
                (existingReservation.requesterGrade && existingReservation.requesterClass ? 
                    `${existingReservation.requesterGrade}-${existingReservation.requesterClass}` : 
                    existingReservation.requester);
            return { status: 'occupied', requester: displayText };
        }
    }
    
    // 대기중인 예약이 있는지 확인
    const pendingReservation = facilityRequests.find(req => 
        req.useDate === date && 
        req.useTime === period && 
        req.status === 'pending'
    );
    
    if (pendingReservation) {
        if (pendingReservation.requester === currentUser.name && 
            pendingReservation.requesterGrade == currentUser.grade && 
            pendingReservation.requesterClass == currentUser.class) {
            // 협의 예약인지 확인
            const displayText = pendingReservation.crossGradeReservation ? '내 예약(협의)' : '내 예약';
            return { status: 'my-reservation', requester: displayText };
        } else {
            // 협의 예약인 경우 displayName 사용, 아니면 기존 로직
            const displayText = pendingReservation.crossGradeReservation && pendingReservation.displayName ? 
                pendingReservation.displayName : 
                (pendingReservation.requesterGrade && pendingReservation.requesterClass ? 
                    `${pendingReservation.requesterGrade}-${pendingReservation.requesterClass}` : 
                    pendingReservation.requester);
            return { status: 'occupied', requester: displayText };
        }
    }
    
    // 다른 학년 전용 시간대인지 확인
    const dayOfWeek = new Date(date).getDay();
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const dayName = dayNames[dayOfWeek];
    
    // 기본 배정 확인
    const dayAssignments = defaultAssignments[currentFacility][dayName];
    const assignedGrade = dayAssignments ? dayAssignments[period] : null;
    
    if (assignedGrade) {
        // 사서도우미 시간 처리 (도서관만)
        if (currentFacility === 'library' && assignedGrade === '사서도우미') {
            return { status: 'disabled' };
        }
        
        const assignedGrades = assignedGrade.split(',');
        const canAccess = currentUser && currentUser.grade && 
                         assignedGrades.includes(currentUser.grade.toString());
        
        if (!canAccess) {
            return { status: 'other-grade' };
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
    
    // 현재 예약 개수 확인
    const today = new Date();
    const thisMonday = new Date(today);
    thisMonday.setDate(today.getDate() - today.getDay() + 1);
    const currentCount = getWeeklyReservationCount(thisMonday, 'computer', currentUser);
    
    // 해당 시간이 내 학년 전용인지 확인
    const dayOfWeek = new Date(date).getDay();
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const dayName = dayNames[dayOfWeek];
    const dayAssignments = defaultAssignments.computer[dayName];
    const assignedGrade = dayAssignments ? dayAssignments[period] : null;
    const isMyGradeSlot = assignedGrade && assignedGrade.split(',').includes(currentUser.grade.toString());
    
    // 2번째 예약부터는 같은 학년 시간대에서 다른 선생님 허락 확인
    if (currentCount >= 1 && isMyGradeSlot) {
        const confirmed = confirm('이미 이번 주에 정해진 시간에 예약이 1번 되었습니다.\n\n같은 학년 다른 선생님께 허락받으셨나요?\n\n"확인"을 누르면 예약이 진행됩니다.');
        if (!confirmed) {
            return; // 취소 시 예약 중단
        }
    }
    
    // 3번 이상은 막기
    if (currentCount >= 2) {
        alert(`⚠️ 컴퓨터실 주간 사용 제한\n\n개인당 1주일에 최대 2번까지만 예약 가능합니다.\n현재 이번 주 사용 횟수: ${currentCount}/2\n\n기존 예약을 취소한 후 다시 시도해주세요.`);
        return;
    }

    // 새 예약
    selectedSlot = { date, period, time };
    
    document.getElementById('modalTitle').textContent = `${period} 예약`;
    document.getElementById('modalSubtitle').textContent = `${date} ${time}에 컴퓨터실을 예약하시겠습니까?\n\n📊 이번 주 사용 현황: ${currentCount}/2회`;
    
    const modal = document.getElementById('reservationModal');
    modal.classList.add('active');
}

// 예약 취소
async function cancelReservation(date, period) {
    console.log('🗑️ 예약 취소 시작:', { date, period, user: currentUser });
    
    const computerRoomRequests = requests.computerRoom || [];
    console.log('🔍 현재 컴퓨터실 예약 목록:', computerRoomRequests);
    
    const reservation = computerRoomRequests.find(req => 
        req.useDate === date && 
        req.useTime === period && 
        req.requester === currentUser.name && 
        req.requesterGrade == currentUser.grade && 
        req.requesterClass == currentUser.class
    );
    
    console.log('🎯 찾은 예약:', reservation);
    
    if (reservation) {
        // Firebase에서 삭제 (id가 있는 경우)
        if (reservation.firestoreId || reservation.id) {
            const db = getDbManager();
            const docId = reservation.firestoreId || reservation.id;
            console.log('🔥 Firebase 삭제 시도:', { docId, isConnected: db?.isConnected() });
            
            if (db && db.isConnected()) {
                try {
                    await db.deleteDocument('computerRoomRequests', docId);
                    console.log('✅ Firebase에서 예약 삭제 성공:', docId);
                } catch (error) {
                    console.error('❌ Firebase 삭제 오류:', error);
                }
            } else {
                console.log('⚠️ Firebase 미연결 - localStorage만 삭제');
            }
        } else {
            console.log('⚠️ Firebase ID 없음 - localStorage만 삭제');
        }
        
        // localStorage에서 삭제
        const reservationIndex = computerRoomRequests.findIndex(req => req === reservation);
        console.log('📍 삭제할 예약 인덱스:', reservationIndex);
        
        if (reservationIndex !== -1) {
            computerRoomRequests.splice(reservationIndex, 1);
            localStorage.setItem('computerRoomRequests', JSON.stringify(computerRoomRequests));
            requests.computerRoom = computerRoomRequests;
            console.log('✅ localStorage에서 예약 삭제 완료');
        }
        
        alert('예약이 취소되었습니다.');
        updateSchedule();
        updateAdminStats();
        updateMainDashboard(); // 메인 대시보드 업데이트
        
        // 취소 후 Firebase에서 데이터 확인
        if (reservation.firestoreId || reservation.id) {
            const docId = reservation.firestoreId || reservation.id;
            setTimeout(async () => {
                const db = getDbManager();
                if (db && db.isConnected()) {
                    try {
                        const allData = await db.getDocuments('computerRoomRequests');
                        const stillExists = allData.find(d => d.id === docId || d.firestoreId === docId);
                        console.log('🔍 삭제 확인:', {
                            docId,
                            stillExists: !!stillExists,
                            totalCount: allData.length
                        });
                        if (stillExists) {
                            console.error('⚠️ 경고: 삭제된 예약이 Firebase에 여전히 존재함!', stillExists);
                        }
                    } catch (error) {
                        console.error('❌ 삭제 확인 중 오류:', error);
                    }
                }
            }, 2000); // 2초 후 확인
        }
        
        console.log('🔄 업데이트 완료 - 현재 예약 상태:', requests.computerRoom);
    } else {
        console.log('❌ 취소할 예약을 찾을 수 없음');
    }
}

// 예약 확인 모달 닫기
function closeReservationModal() {
    const modal = document.getElementById('reservationModal');
    modal.classList.remove('active');
    selectedSlot = null;
}

// 중복 예약 검사 함수
function checkDuplicateReservation(date, period) {
    // 모든 시설의 예약을 확인
    const allReservations = [
        ...(requests.computerRoom || []),
        ...(requests.tabletRouter || []),
        ...(requests.library || [])
    ];
    
    // 같은 날짜, 같은 시간에 내가 예약한 것이 있는지 확인
    const existingReservation = allReservations.find(req => 
        req.useDate === date && 
        req.useTime === period && 
        req.requester === currentUser.name &&
        req.requesterGrade == currentUser.grade &&
        req.requesterClass == currentUser.class &&
        (req.status === 'approved' || req.status === 'pending')
    );
    
    if (existingReservation) {
        // 시설명 결정
        let facilityName = '알 수 없는 시설';
        if (requests.computerRoom?.includes(existingReservation)) {
            facilityName = '컴퓨터실';
        } else if (requests.tabletRouter?.includes(existingReservation)) {
            facilityName = '공유기실';
        } else if (requests.library?.includes(existingReservation)) {
            facilityName = '도서관';
        }
        
        return {
            isDuplicate: true,
            facility: facilityName,
            reservation: existingReservation
        };
    }
    
    return {
        isDuplicate: false
    };
}

// 예약 확정 (Firebase 지원)
async function confirmReservation() {
    if (!selectedSlot) {
        alert('선택된 시간이 없습니다.');
        return;
    }
    
    // 중복 예약 검사
    const duplicateCheck = checkDuplicateReservation(selectedSlot.date, selectedSlot.period);
    if (duplicateCheck.isDuplicate) {
        alert(`예약이 겹쳐서 신청할 수 없습니다.\n\n이미 ${selectedSlot.date} ${selectedSlot.period}에 ${duplicateCheck.facility} 예약이 있습니다.`);
        return;
    }
    
    // dbManager 안전 접근
    const db = getDbManager();
    
    // 시설별 컬렉션 이름 결정
    const collectionName = currentFacility === 'computer' ? 'computerRoomRequests' : 
                          currentFacility === 'router' ? 'tabletRouterRequests' : 'libraryRequests';
    
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
        const firestoreId = await db.addDocument(collectionName, reservation);
        
        // Firebase ID를 예약 데이터에 추가 (삭제를 위해 필요)
        if (firestoreId) {
            reservation.firestoreId = firestoreId;
        }
        
        // 로컬 requests 객체 즉시 업데이트 (시간표 즉시 반영을 위해)
        if (currentFacility === 'computer') {
            if (!requests.computerRoom) {
                requests.computerRoom = [];
            }
            requests.computerRoom.push(reservation);
            // localStorage도 직접 업데이트
            localStorage.setItem('computerRoomRequests', JSON.stringify(requests.computerRoom));
        } else if (currentFacility === 'router') {
            if (!requests.tabletRouter) {
                requests.tabletRouter = [];
            }
            requests.tabletRouter.push(reservation);
            // localStorage도 직접 업데이트
            localStorage.setItem('tabletRouterRequests', JSON.stringify(requests.tabletRouter));
        } else if (currentFacility === 'library') {
            if (!requests.library) {
                requests.library = [];
            }
            requests.library.push(reservation);
            // localStorage도 직접 업데이트
            localStorage.setItem('libraryRequests', JSON.stringify(requests.library));
        }
        
        console.log('✅ 로컬 메모리 및 저장소 업데이트 완료:', reservation);
        
        const facilityName = currentFacility === 'computer' ? '컴퓨터실' : 
                         currentFacility === 'router' ? '공유기 (늘봄교실3)' : '도서관';
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
        updateMainDashboard(); // 메인 대시보드 예약 현황 업데이트
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
    // 학교 비밀번호가 이미 인증된 경우 학년/반 선택으로
    const isPasswordVerified = localStorage.getItem('schoolPasswordVerified') === 'true';
    if (isPasswordVerified) {
        document.getElementById('gradeClassForm').style.display = 'block';
        document.getElementById('schoolPasswordForm').style.display = 'none';
        document.getElementById('loginDescription').textContent = '담임하시는 학년과 반을 선택해주세요';
    } else {
        document.getElementById('schoolPasswordForm').style.display = 'block';
        document.getElementById('gradeClassForm').style.display = 'none';
        document.getElementById('loginDescription').textContent = '학교 시스템에 접속하기 위해 비밀번호를 입력해주세요';
    }
    document.getElementById('adminLoginForm').style.display = 'none';
    document.getElementById('loginDescription').style.display = 'block';
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
        console.log('🔍 예약 상태 디버깅:', reservationStatus);
        console.log('📊 현재 사용자:', currentUser);
        console.log('📋 requests 객체:', requests);
        
        // 컴퓨터실 예약 화면과 동일한 형태의 예약 상태 위젯 생성
        const createReservationWidget = (computerReservations, routerReservations, libraryReservations) => {
            console.log('🎨 위젯 생성 중:', { computerReservations, routerReservations, libraryReservations });
            
            // 컴퓨터실 예약 화면과 동일한 방식으로 셀 상태 확인
            function getCellStatus(dayParam, period, dateStr, allReservations) {
                // 실제 날짜에서 요일을 직접 계산 (dayParam 대신 dateStr 사용)
                const date = new Date(dateStr);
                const dayOfWeek = date.getDay(); // 0=일, 1=월, 2=화...
                const actualDayNames = ['일', '월', '화', '수', '목', '금', '토'];
                const actualDay = actualDayNames[dayOfWeek];
                
                console.log(`🔍 셀 상태 확인: dateStr=${dateStr}, dayOfWeek=${dayOfWeek}, actualDay=${actualDay}, period=${period}`);
                
                // 해당 날짜와 교시에 예약이 있는지 확인
                const existingReservation = allReservations.find(req => 
                    req.useDate === dateStr && 
                    req.useTime === period && 
                    req.requester === currentUser.name &&
                    req.requesterGrade == currentUser.grade &&
                    req.requesterClass == currentUser.class &&
                    (req.status === 'approved' || req.status === 'pending')
                );
                
                if (existingReservation) {
                    console.log(`✅ 예약 발견: ${dateStr} ${period} - ${existingReservation.facility}`);
                }
                
                if (existingReservation) {
                    // 내 예약이 있음 - 어떤 시설인지 표시
                    const facilityName = existingReservation.facility || 
                        (requests.computerRoom?.includes(existingReservation) ? '컴퓨터실' :
                         requests.tabletRouter?.includes(existingReservation) ? '공유기' : '도서관');
                    
                    const displayText = existingReservation.crossGradeReservation ? 
                        `${facilityName}(협의)` : facilityName;
                    
                    // 시설별 색깔 구분을 위한 클래스 추가
                    let facilityClass = 'my-reservation';
                    if (facilityName === '컴퓨터실') {
                        facilityClass += ' computer-reservation';
                    } else if (facilityName === '공유기') {
                        facilityClass += ' router-reservation';
                    } else if (facilityName === '도서관') {
                        facilityClass += ' library-reservation';
                    }
                    
                    return {
                        status: facilityClass,
                        content: displayText,
                        clickable: false
                    };
                }
                
                return {
                    status: 'available',
                    content: '',
                    clickable: false
                };
            }
            
            // 모든 예약을 합치기 (시설명 추가)
            const allReservations = [
                ...(computerReservations || []).map(r => ({...r, facility: '컴퓨터실'})),
                ...(routerReservations || []).map(r => ({...r, facility: '공유기'})),
                ...(libraryReservations || []).map(r => ({...r, facility: '도서관'}))
            ];
            
            console.log('📊 모든 예약:', allReservations);
            
            // 오늘 날짜 기준으로 이번주 월요일 계산 (컴퓨터실 화면과 동일한 방식)
            const today = new Date();
            const dashboardMonday = new Date(today);
            dashboardMonday.setDate(today.getDate() - today.getDay() + 1);
            
            // ISO 주차 방식으로 정확한 월요일 계산 (컴퓨터실과 동일)
            const thisYear = dashboardMonday.getFullYear();
            const thisWeekNumber = getWeekNumber(dashboardMonday);
            const thisMonday = getDateFromWeek(thisYear, thisWeekNumber);
            
            console.log('🔍 대시보드 날짜 계산:', {
                today: today.toISOString().split('T')[0],
                dashboardMonday: dashboardMonday.toISOString().split('T')[0],
                thisMonday: thisMonday.toISOString().split('T')[0]
            });
            
            // 2주치 날짜 생성
            const weeks = [];
            for (let w = 0; w < 2; w++) {
                const weekStart = new Date(thisMonday);
                weekStart.setDate(thisMonday.getDate() + (w * 7));
                
                const weekDays = [];
                for (let d = 0; d < 5; d++) { // 월~금
                    const day = new Date(weekStart);
                    day.setDate(weekStart.getDate() + d);
                    weekDays.push(day);
                }
                weeks.push({
                    label: w === 0 ? '이번주' : '다음주',
                    days: weekDays
                });
            }
            
            const periods = ['1교시', '2교시', '3교시', '4교시', '5교시', '6교시'];
            const weekdays = ['월', '화', '수', '목', '금'];
            
            const hasAnyReservation = allReservations.length > 0;
            
            return `
                <div class="reservation-widget ${hasAnyReservation ? 'has-reservations' : ''}">
                    <div class="widget-header">📅 나의 2주간 예약 현황(${currentUser.grade}학년 ${currentUser.class}반)</div>
                    <div class="facility-legend">
                        <div class="legend-item">
                            <div class="legend-color computer-color"></div>
                            <span>컴퓨터실</span>
                        </div>
                        <div class="legend-item">
                            <div class="legend-color router-color"></div>
                            <span>공유기실</span>
                        </div>
                        <div class="legend-item">
                            <div class="legend-color library-color"></div>
                            <span>도서관</span>
                        </div>
                    </div>
                    <div class="reservation-table-container">
                        <div class="weeks-wrapper">
                            ${weeks.map(week => {
                                let tableHTML = `
                                    <div class="week-section">
                                        <div class="week-header">${week.label}</div>
                                        <table class="weekly-schedule-table">
                                            <thead>
                                                <tr>
                                                    <th class="period-header">교시</th>
                                `;
                                
                                // 요일 헤더
                                week.days.forEach((day, index) => {
                                    const dateStr = `${day.getMonth() + 1}/${day.getDate()}`;
                                    // 실제 요일을 날짜에서 직접 계산
                                    const dayOfWeek = day.getDay(); // 0=일, 1=월, 2=화...
                                    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
                                    const actualDayName = dayNames[dayOfWeek];
                                    tableHTML += `<th class="day-header">${actualDayName}<br><small>${dateStr}</small></th>`;
                                    
                                    // 디버깅: 헤더 확인
                                    console.log(`📅 헤더 확인: index=${index}, day=${day.toISOString().split('T')[0]}, dayOfWeek=${dayOfWeek}, actualDayName=${actualDayName}`);
                                });
                                
                                tableHTML += `
                                                </tr>
                                            </thead>
                                            <tbody>
                                `;
                                
                                // 교시별 행 생성
                                periods.forEach(period => {
                                    tableHTML += `
                                        <tr>
                                            <th class="period-label">${period}</th>
                                    `;
                                    
                                    week.days.forEach((day, dayIndex) => {
                                        const date = new Date(day);
                                        const dateStr = date.toISOString().split('T')[0];
                                        
                                        // 실제 날짜에서 요일 직접 계산 (weekdays[dayIndex] 대신)
                                        const dayOfWeek = date.getDay();
                                        const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
                                        const actualDayName = dayNames[dayOfWeek];
                                        
                                        // 디버깅 로그 추가
                                        if (period === '1교시') {
                                            console.log(`📅 셀 매핑 확인: ${dateStr} -> dayIndex: ${dayIndex}, dayOfWeek: ${dayOfWeek}, actualDayName: ${actualDayName}`);
                                        }
                                        
                                        const cellStatus = getCellStatus(actualDayName, period, dateStr, allReservations);
                                        const cellClass = cellStatus.status;
                                        const displayText = cellStatus.content || '';
                                        
                                        tableHTML += `
                                            <td>
                                                <button class="schedule-cell ${cellClass}">
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
                                    </div>
                                `;
                                
                                return tableHTML;
                            }).join('')}
                        </div>
                    </div>
                </div>
            `;
        };
        
        // 선생님 메뉴 표시
        content.innerHTML = `
            ${createReservationWidget(reservationStatus.computer, reservationStatus.router, reservationStatus.library)}
            
            <div class="usage-guide">
                💡 메뉴 클릭 → 시설 예약 | 위 표에서 예약 현황 확인<br>
                • 다른 학년 예약 시 해당 학년 선생님과 협의 후 사용<br>
                • 내 예약(파란색/주황색/초록색) 다시 클릭 시 취소 가능<br>
                
            </div>
            
            <div class="menu-grid">
                <div class="menu-item" onclick="openPage('computer-room')">
                    <h3>💻 컴퓨터실 예약</h3>
                    <p>컴퓨터실 이용 시간을 예약합니다</p>
                </div>
                <div class="menu-item" onclick="openPage('router')">
                    <h3>📱 공유기실 예약</h3>
                    <p>공유기(늘봄교실3) 이용 시간을 예약합니다</p>
                </div>
                <div class="menu-item" onclick="openPage('library')">
                    <h3>📚 도서관 이용 예약</h3>
                    <p>도서관 이용 시간을 예약합니다</p>
                </div>
                <div class="menu-item" onclick="window.open('https://docs.google.com/spreadsheets/d/10hevdZ2pwIfNjpfnmVD275eH38b-sWBytjj8J6fWqzQ/edit?usp=sharing', '_blank')">
                    <h3>🔧 2025 정보기기 유기보수 대장</h3>
                    <p>정보기기 유기대장을 작성합니다.</p>
                </div>
                <div class="menu-item" onclick="window.open('https://docs.google.com/spreadsheets/d/1AbB2kzRzzTyBxDhkjyqcASnn5rhgnLzPD94KoHfCBpc/edit?usp=sharing', '_blank')">
                    <h3>🖨️ 프린터 잉크 및 실물화상 수리대장</h3>
                    <p>프린터 잉크 신청 및 실물화상기 수리대장을 작성합니다</p>
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
    console.log('📊 updateMainDashboard 호출됨');
    
    // 현재 메인 메뉴가 표시된 상태인지 확인
    const menuGrid = document.querySelector('.menu-grid');
    const reservationWidget = document.querySelector('.reservation-widget');
    
    if ((menuGrid || reservationWidget) && currentUser && currentUser.type === 'teacher') {
        console.log('📊 메인 대시보드 예약 상태 업데이트 실행');
        
        // 약간의 지연 후 업데이트 (DOM 조작 완료 보장)
        setTimeout(() => {
            goBack(); // 메뉴를 다시 그려서 최신 예약 상태 반영
        }, 50);
    } else {
        console.log('📊 업데이트 조건 불충족:', {
            hasMenuGrid: !!menuGrid,
            hasReservationWidget: !!reservationWidget,
            hasCurrentUser: !!currentUser,
            isTeacher: currentUser?.type === 'teacher'
        });
    }
}

// 다른 학년 협의 예약 기능

function showCrossGradeConfirmation(date, period, time, day) {
    const confirmed = confirm('해당 학년 선생님과 협의하셨나요?\n\n"예"를 누르면 예약이 진행됩니다.');
    
    if (confirmed) {
        // 협의 완료된 예약으로 처리
        processCrossGradeReservation(date, period, time, day);
    }
}

async function processCrossGradeReservation(date, period, time, day) {
    // 중복 예약 검사
    const duplicateCheck = checkDuplicateReservation(date, period);
    if (duplicateCheck.isDuplicate) {
        alert(`예약이 겹쳐서 신청할 수 없습니다.\n\n이미 ${date} ${period}에 ${duplicateCheck.facility} 예약이 있습니다.`);
        return;
    }
    
    const db = getDbManager();
    
    // 예약 데이터 생성 (협의 표시 포함)
    const reservation = {
        id: Date.now(),
        requester: currentUser.name, // 원래 이름으로 저장 (내 예약 확인을 위해)
        requesterGrade: currentUser.grade || null,
        requesterClass: currentUser.class || null,
        originalRequesterGrade: currentUser.grade,
        originalRequesterName: currentUser.name,
        crossGradeReservation: true, // 협의 예약 표시
        displayName: `${currentUser.grade}-${currentUser.class}(협의)`, // 표시용 이름 간소화
        status: 'approved',
        submittedAt: new Date().toLocaleString('ko-KR'),
        processedAt: new Date().toLocaleString('ko-KR'),
        requestDate: new Date().toISOString().split('T')[0],
        useDate: date,
        useTime: period,
        facility: currentFacility, // 현재 시설 (computer 또는 router)
        schoolName: '두정초등학교'
    };
    
    try {
        // 현재 시설에 맞는 컬렉션 이름 결정
        const collectionName = currentFacility === 'computer' ? 'computerRoomRequests' : 
                          currentFacility === 'router' ? 'tabletRouterRequests' : 'libraryRequests';
        const storageKey = currentFacility === 'computer' ? 'computerRoomRequests' : 
                      currentFacility === 'router' ? 'tabletRouterRequests' : 'libraryRequests';
        const requestsKey = currentFacility === 'computer' ? 'computerRoom' : 
                           currentFacility === 'router' ? 'tabletRouter' : 'library';
        
        // 데이터베이스에 저장
        const firestoreId = await db.addDocument(collectionName, reservation);
        
        if (firestoreId) {
            reservation.firestoreId = firestoreId;
        }
        
        // 로컬 데이터 업데이트
        if (!requests[requestsKey]) {
            requests[requestsKey] = [];
        }
        requests[requestsKey].push(reservation);
        localStorage.setItem(storageKey, JSON.stringify(requests[requestsKey]));
        
        const facilityName = currentFacility === 'computer' ? '컴퓨터실' : '공유기';
        alert(`다른 학년 시간대 ${facilityName} 예약이 완료되었습니다.\n(협의 완료 표시됨)`);
        
        // 화면 업데이트
        if (document.getElementById('weeklyScheduleContainer')) {
            updateWeeklySchedule();
        }
        if (document.getElementById('scheduleGrid')) {
            updateSchedule();
        }
        updateAdminStats();
        updateMainDashboard();
        
    } catch (error) {
        console.error('❌ 협의 예약 처리 오류:', error);
        alert('예약 처리 중 오류가 발생했습니다.');
    }
}