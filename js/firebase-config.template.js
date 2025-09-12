// Firebase 설정 템플릿 - 실제 사용 시 firebase.google.com에서 프로젝트 생성 후 설정값을 입력하세요
// 이 파일을 firebase-config.js로 복사하고 아래 설정값들을 실제 값으로 교체하세요

const firebaseConfig = {
  apiKey: "your-api-key-here",
  authDomain: "your-project-id.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.firebasestorage.app",
  messagingSenderId: "your-sender-id",
  appId: "your-app-id"
};

// Firebase 앱 초기화 확인
let db = null;
let isFirebaseEnabled = false;

try {
    // Firebase 설정이 올바르게 되어 있는지 확인
    if (firebaseConfig.apiKey !== "your-api-key-here") {
        // Firebase 초기화
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        isFirebaseEnabled = true;
        
        // window 객체에 설정 (DatabaseManager가 접근할 수 있도록)
        window.db = db;
        window.isFirebaseEnabled = isFirebaseEnabled;
        
        console.log("✅ Firebase 연결됨 - 실시간 데이터베이스 사용");
        
        // Firestore 오프라인 지원 활성화 (경고 방지를 위해 주석 처리)
        // db.enablePersistence().catch((err) => {
        //     if (err.code == 'failed-precondition') {
        //         console.log("⚠️ 여러 탭이 열려 있어 오프라인 지원이 제한됨");
        //     } else if (err.code == 'unimplemented') {
        //         console.log("⚠️ 브라우저가 오프라인 지원을 하지 않음");
        //     }
        // });
    } else {
        console.log("⚡ Firebase 미설정 - localStorage 사용 (데모 모드)");
        console.log("🔥 실제 사용을 위해 Firebase 프로젝트를 설정하세요:");
        console.log("1. https://console.firebase.google.com 방문");
        console.log("2. 새 프로젝트 생성");
        console.log("3. Firestore 데이터베이스 설정");
        console.log("4. 웹 앱 추가하여 설정값 복사");
        console.log("5. js/firebase-config.js 파일의 설정값 교체");
    }
} catch (error) {
    console.log("⚡ Firebase 로딩 실패 - localStorage 사용 (데모 모드)");
    console.log("오류:", error.message);
}

// Firebase 설정 안내 표시
function showFirebaseSetupGuide() {
    if (!isFirebaseEnabled) {
        const notice = document.createElement('div');
        notice.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 12px;
            text-align: center;
            font-size: 14px;
            z-index: 10000;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        `;
        notice.innerHTML = `
            🔥 <strong>데모 모드</strong> - 실제 사용을 위해서는 Firebase 설정이 필요합니다. 
            <a href="https://console.firebase.google.com" target="_blank" style="color: #ffd700; text-decoration: underline;">Firebase 콘솔</a>에서 프로젝트를 생성하세요.
            <button onclick="this.parentElement.remove()" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 4px 8px; border-radius: 4px; margin-left: 10px; cursor: pointer;">닫기</button>
        `;
        document.body.appendChild(notice);
        
        // 10초 후 자동 제거
        setTimeout(() => {
            if (notice.parentElement) {
                notice.remove();
            }
        }, 10000);
    }
}

// 페이지 로드 시 Firebase 설정 상태 확인
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(showFirebaseSetupGuide, 2000);
});