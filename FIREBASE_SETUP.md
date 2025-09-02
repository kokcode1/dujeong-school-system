# 🔥 Firebase 설정 가이드

두정초등학교 시설 관리 시스템을 실제 학교에서 사용하기 위한 Firebase 설정 방법입니다.

## 📋 설정 단계

### 1단계: Firebase 프로젝트 생성

1. [Firebase 콘솔](https://console.firebase.google.com) 접속
2. "프로젝트 추가" 클릭
3. 프로젝트 이름: `dujeong-school-system` (또는 원하는 이름)
4. Google Analytics는 선택사항 (비활성화해도 됨)
5. 프로젝트 생성 완료

### 2단계: Firestore 데이터베이스 설정

1. 좌측 메뉴에서 "Firestore Database" 클릭
2. "데이터베이스 만들기" 클릭
3. **보안 규칙**: "테스트 모드에서 시작" 선택 (나중에 수정 가능)
4. **위치**: `asia-northeast3 (Seoul)` 선택 (한국 서버)
5. "완료" 클릭

### 3단계: 웹 앱 추가

1. 프로젝트 개요에서 웹 아이콘 `</>` 클릭
2. 앱 이름: `두정초 시설관리` (또는 원하는 이름)
3. Firebase Hosting은 선택사항 (체크 안 해도 됨)
4. "앱 등록" 클릭

### 4단계: 설정 정보 복사

등록 완료 후 나타나는 설정 정보를 복사합니다:

```javascript
const firebaseConfig = {
  apiKey: "your-api-key-here",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "your-app-id"
};
```

### 5단계: 프로젝트에 설정 적용

1. `js/firebase-config.js` 파일 열기
2. `firebaseConfig` 객체의 값들을 복사한 실제 값으로 교체:

```javascript
const firebaseConfig = {
    // 👇 여기를 Firebase에서 복사한 실제 값으로 교체
    apiKey: "AIzaSyC...",  // 실제 API 키
    authDomain: "dujeong-school-system.firebaseapp.com",
    projectId: "dujeong-school-system",
    storageBucket: "dujeong-school-system.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef123456"
};
```

## 🔒 보안 규칙 설정 (선택사항)

실제 운영 시 보안을 위해 Firestore 규칙을 수정하세요:

1. Firebase 콘솔 → Firestore Database → 규칙 탭
2. 다음 규칙으로 변경:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 두정초등학교 관련 문서만 읽기/쓰기 허용
    match /{document=**} {
      allow read, write: if resource.data.schoolName == '두정초등학교';
    }
  }
}
```

## ✅ 설정 확인

1. 웹사이트 새로고침
2. 콘솔에서 "✅ Firebase 연결됨" 메시지 확인
3. 예약 시 "실시간 데이터베이스에 저장되어..." 메시지 확인
4. Firebase 콘솔에서 Firestore → 데이터 탭에서 데이터 저장 확인

## 💡 Firebase 활용 효과

### 설정 전 (데모 모드)
- ❌ 각 컴퓨터별로 다른 데이터
- ❌ 예약 충돌 발생 가능
- ❌ 실시간 동기화 없음

### 설정 후 (실제 운영)
- ✅ 모든 선생님이 동일한 데이터 확인
- ✅ 예약 충돌 자동 방지
- ✅ 실시간 예약 현황 동기화
- ✅ 관리자가 모든 신청 확인 가능

## 🆓 무료 사용량

Firebase 무료 Spark 플랜으로 충분합니다:
- **Firestore**: 1GB 저장소, 50,000 읽기/20,000 쓰기 (일일)
- **대역폭**: 10GB/월
- **두정초 예상 사용량**: 무료 한도의 1% 미만

## 🔧 문제 해결

### Firebase 연결 안 됨
1. `js/firebase-config.js`의 설정값 재확인
2. 브라우저 콘솔에서 오류 메시지 확인
3. Firestore 데이터베이스가 생성되었는지 확인

### 데이터가 저장 안 됨
1. Firestore 보안 규칙 확인
2. 인터넷 연결 상태 확인
3. 브라우저 콘솔에서 오류 메시지 확인

## 📞 도움이 필요하면

Firebase 설정에 문제가 있으면:
1. [Firebase 공식 문서](https://firebase.google.com/docs/firestore/quickstart) 참조
2. 브라우저 개발자 도구(F12) → 콘솔 탭에서 오류 메시지 확인
3. Firebase 콘솔의 사용량 탭에서 API 호출 상태 확인

설정이 완료되면 **진짜 학교에서 사용 가능한 실시간 시설 관리 시스템**이 됩니다! 🎉