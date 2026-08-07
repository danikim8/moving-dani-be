import {
  PrismaClient,
  UserType,
  MoveType,
  RegionType,
  AddressRole,
  RequestStatus,
  EstimateStatus,
  NotificationType,
  LangCode
} from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

const hashPassword = async (plain: string) => await bcrypt.hash(plain, 10);

const randomPhone = () => `010${Math.floor(1000 + Math.random() * 9000)}${Math.floor(1000 + Math.random() * 9000)}`;
const randomName = ["김철수", "이영희", "박민수", "최지영", "한서준", "장도윤", "유지안", "서지우"];
const randomDistrict = ["강남구", "송파구", "은평구", "수성구", "남구", "해운대구", "중구", "동작구"];
const randomRegion = [RegionType.SEOUL, RegionType.DAEGU, RegionType.GYEONGGI, RegionType.BUSAN];
const randomMoveTypes = [MoveType.HOME, MoveType.OFFICE, MoveType.SMALL];
const randomReview = [
  "최악이었어요. 추천하지 않습니다.",
  "생각보다 아쉬운 점이 많았습니다.",
  "무난했습니다. 특별히 좋지도 나쁘지도 않았어요.",
  "대체로 만족하지만 조금 더 꼼꼼했으면 좋았을 것 같아요.",
  "기사님이 너무 친절하시고 꼼꼼하셨어요."
];

// [from, to] 주소 인덱스 조합 — 견적 추정 에이전트(search_past_quotes)가 여러 지역 조합을
// 테스트할 수 있도록 SEOUL->DAEGU 한 조합에 몰아주지 않고 골고루 분산시킨다.
// addressList: 0=서울/강남구, 1=대구/수성구, 2=경기/장안구, 3=부산/해운대구, 4=서울/중구
const ROUTE_PAIRS: [number, number][] = [
  [0, 1], // 서울 -> 대구
  [0, 2], // 서울 -> 경기
  [2, 3], // 경기 -> 부산
  [4, 3], // 서울(중구) -> 부산
  [1, 3], // 대구 -> 부산
  [0, 4] // 서울 -> 서울(중구)
];

async function main() {
  // 기존 데이터 삭제 (외래키 제약조건 순서 고려)
  console.log("🧹 기존 테스트 데이터 삭제 중...");
  await prisma.driverEstimateRejection.deleteMany();
  await prisma.designatedDriver.deleteMany();
  await prisma.review.deleteMany();
  await prisma.estimate.deleteMany();
  await prisma.estimateRequest.deleteMany();
  await prisma.customerAddress.deleteMany();
  await prisma.address.deleteMany();
  await prisma.driverServiceArea.deleteMany();
  await prisma.favorite.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.driver.deleteMany();
  await prisma.authUser.deleteMany();
  await prisma.languagePreference.deleteMany();
  console.log("✅ 기존 데이터 삭제 완료");

  console.log("시드 데이터 생성 중...");
  // 고객 10명
  const customerIds: string[] = [];
  const customerAuthUserIds: string[] = [];
  for (let i = 0; i < 10; i++) {
    //랜덤 movetype
    const count = Math.floor(Math.random() * 3) + 1;
    const shuffled = [...randomMoveTypes].sort(() => 0.5 - Math.random());
    const randomList = shuffled.slice(0, count);

    const authUser = await prisma.authUser.create({
      data: {
        email: `customer${i + 1}@test.com`,
        password: await hashPassword(`1q2w3e4r!`),
        phone: randomPhone(),
        userType: UserType.CUSTOMER,
        name: randomName[i % randomName.length],

        customer: {
          create: {
            moveType: randomList,
            currentArea: randomDistrict[i % randomDistrict.length],
            moveDate: new Date(`2025-08-0${i + 1}`)
          }
        }
      },
      include: { customer: true }
    });
    customerIds.push(authUser.customer!.id);
    customerAuthUserIds.push(authUser.id);
  }

  // 기사 10명
  const driverIds: string[] = [];
  const driverAuthUserIds: string[] = [];
  for (let i = 0; i < 10; i++) {
    const count = Math.floor(Math.random() * 3) + 1;
    const shuffled = [...randomMoveTypes].sort(() => 0.5 - Math.random());
    const randomList = shuffled.slice(0, count);
    const authUser = await prisma.authUser.create({
      data: {
        email: `driver${i + 1}@test.com`,
        password: await hashPassword(`1q2w3e4r!`),
        phone: randomPhone(),
        userType: UserType.DRIVER,
        name: randomName[(i + 5) % randomName.length],

        driver: {
          create: {
            nickname: `기사${i + 1}`,
            work: Math.floor(Math.random() * 10) + 1,
            career: i + 1, // Int 타입으로 변경
            shortIntro: `안녕하세요 기사${i + 1}입니다.`,
            detailIntro: `열심히 하겠습니다. 믿고 맡겨주세요.`,
            moveType: randomList,
            serviceAreas: {
              create: [
                {
                  region: randomRegion[i % randomRegion.length],
                  district: randomDistrict[i % randomDistrict.length]
                }
              ]
            }
          }
        }
      },
      include: { driver: true }
    });
    driverIds.push(authUser.driver!.id);
    driverAuthUserIds.push(authUser.id);
  }

  // 언어 설정 (다국어 지원 데이터) — 고객/기사 일부에 ko/en/zh 연결
  const languagePrefs = await Promise.all(
    [LangCode.ko, LangCode.en, LangCode.zh].map((language) => prisma.languagePreference.create({ data: { language } }))
  );
  await prisma.customer.update({ where: { id: customerIds[0] }, data: { languagePrefId: languagePrefs[1].id } }); // en
  await prisma.customer.update({ where: { id: customerIds[1] }, data: { languagePrefId: languagePrefs[2].id } }); // zh
  await prisma.driver.update({ where: { id: driverIds[0] }, data: { languagePrefId: languagePrefs[1].id } }); // en
  console.log("🌱 언어 설정 생성 완료");

  //찜하기
  for (let i = 0; i < 5; i++) {
    const shuffled = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => 0.5 - Math.random());
    const randomList = shuffled.slice(0, 3);

    for (const idx of randomList) {
      const favorite = await prisma.favorite.create({
        data: {
          customerId: customerIds[i],
          driverId: driverIds[idx]
        }
      });
    }
  }

  console.log("🌱 기사, 고객, 찜하기 생성 완료");

  // 주소 5개
  const addressData = [
    {
      postalCode: "12345",
      street: "서울특별시 강남구 테헤란로 1길",
      detail: "101호",
      region: RegionType.SEOUL,
      district: "강남구"
    },
    {
      postalCode: "23456",
      street: "대구광역시 수성구 범어로 10",
      detail: "202호",
      region: RegionType.DAEGU,
      district: "수성구"
    },
    {
      postalCode: "34567",
      street: "경기도 수원시 장안구 정자동 88",
      detail: "303호",
      region: RegionType.GYEONGGI,
      district: "장안구"
    },
    {
      postalCode: "45678",
      street: "부산광역시 해운대구 해운대로 570",
      detail: "404호",
      region: RegionType.BUSAN,
      district: "해운대구"
    },
    {
      postalCode: "56789",
      street: "서울특별시 중구 을지로 100",
      detail: "505호",
      region: RegionType.SEOUL,
      district: "중구"
    }
  ];

  const addressList = await Promise.all(addressData.map((addr) => prisma.address.create({ data: addr })));

  // CustomerAddress 연결
  await Promise.all(
    customerIds.map((cid) =>
      prisma.customerAddress.createMany({
        data: [
          { customerId: cid, addressId: addressList[0].id, role: AddressRole.FROM },
          { customerId: cid, addressId: addressList[1].id, role: AddressRole.TO }
        ],
        skipDuplicates: true
      })
    )
  );

  // 리뷰용 확정된 견적 (지역 조합을 ROUTE_PAIRS로 분산시켜 에이전트의 search_past_quotes가
  // 여러 moveType/지역 조건에서 실제로 다른 결과를 반환하도록 함)
  for (let i = 0; i < 5; i++) {
    for (let j = 0; j < 20; j++) {
      const [fromIdx, toIdx] = ROUTE_PAIRS[(i * 20 + j) % ROUTE_PAIRS.length];
      const estimateRequest = await prisma.estimateRequest.create({
        data: {
          customerId: customerIds[i],
          moveType: randomMoveTypes[Math.floor(Math.random() * 3)],
          moveDate: new Date(2025, 6, j + 1),
          fromAddressId: addressList[fromIdx].id,
          toAddressId: addressList[toIdx].id,
          status: RequestStatus.COMPLETED,
          designatedDrivers: {
            create: {
              driverId: driverIds[j % 10]
            }
          }
        }
      });

      await prisma.estimate.create({
        data: {
          estimateRequestId: estimateRequest.id,
          driverId: driverIds[j % 10],
          price: 150000 + i * 10000,
          comment: `견적 제안드립니다 (${j + 1})`,
          isDesignated: true,
          status: EstimateStatus.ACCEPTED
        }
      });

      await prisma.estimate.create({
        data: {
          estimateRequestId: estimateRequest.id,
          driverId: driverIds[(j + 1) % 10],
          price: 100000 + j * 20000,
          comment: `견적 제안드립니다 (${j + 2})`,
          isDesignated: false,
          status: EstimateStatus.AUTO_REJECTED
        }
      });

      const ratingNum = Math.floor(Math.random() * 5) + 1;
      if (j % 2 === 0) {
        await prisma.review.create({
          data: {
            estimateRequestId: estimateRequest.id,
            driverId: driverIds[j % 10],
            rating: ratingNum,
            content: randomReview[ratingNum - 1],
            customerId: customerIds[i]
          }
        });
      }
    }
  }

  //리뷰 평점 업데이트
  for (const driverId of driverIds) {
    const reviews = await prisma.review.findMany({
      where: { driverId },
      select: { rating: true }
    });

    const total = reviews.reduce((acc, curr) => acc + curr.rating, 0);
    const average = reviews.length ? total / reviews.length : 0;

    await prisma.driver.update({
      where: { id: driverId },
      data: { averageRating: parseFloat(average.toFixed(2)) }
    });
  }

  console.log("🌱 리뷰 생성 완료");

  // EstimateRequest + Estimate + DesignatedDriver
  for (let i = 0; i < 5; i++) {
    const [fromIdx, toIdx] = ROUTE_PAIRS[i % ROUTE_PAIRS.length];
    const req = await prisma.estimateRequest.create({
      data: {
        customerId: customerIds[i],
        moveType: randomMoveTypes[Math.floor(Math.random() * 3)],
        moveDate: new Date(`2025-08-2${i}`),
        fromAddressId: addressList[fromIdx].id,
        toAddressId: addressList[toIdx].id,
        status: RequestStatus.PENDING
      }
    });

    await prisma.estimate.create({
      data: {
        estimateRequestId: req.id,
        driverId: driverIds[i],
        price: 100000 + i * 50000,
        comment: `견적 제안드립니다 (${i + 1})`,
        isDesignated: false,
        status: EstimateStatus.PROPOSED
      }
    });
    await prisma.estimate.create({
      data: {
        estimateRequestId: req.id,
        driverId: driverIds[i + 5],
        price: 100000 + i * 40000,
        comment: `견적 제안드립니다 (${i + 6})`,
        isDesignated: false,
        status: EstimateStatus.PROPOSED
      }
    });

    // DriverEstimateRejection 샘플 데이터 추가
    if (i === 0) {
      await prisma.driverEstimateRejection.create({
        data: {
          estimateRequestId: req.id,
          driverId: driverIds[i],
          reason: "일정이 맞지 않아서 반려합니다."
        }
      });
    }
  }
  for (let i = 5; i < 10; i++) {
    const [fromIdx, toIdx] = ROUTE_PAIRS[i % ROUTE_PAIRS.length];
    const req = await prisma.estimateRequest.create({
      data: {
        customerId: customerIds[i],
        moveType: randomMoveTypes[Math.floor(Math.random() * 3)],
        moveDate: new Date(`2025-08-2${i}`),
        fromAddressId: addressList[fromIdx].id,
        toAddressId: addressList[toIdx].id,
        status: RequestStatus.PENDING,
        designatedDrivers: {
          create: {
            driverId: driverIds[i]
          }
        }
      }
    });
  }
  console.log("🌱 견적 및 요청 생성 완료");

  // 알림 (NotificationType 12종 전부 최소 1건씩 — 관리자/포폴 화면에서 전체 시스템이 보이도록)
  console.log("알림 데이터 생성 중...");
  for (const authUserId of [...customerAuthUserIds, ...driverAuthUserIds]) {
    await prisma.notification.create({
      data: {
        receiverId: authUserId,
        message: "무빙에 오신 것을 환영합니다!",
        path: "/",
        type: NotificationType.WELCOME,
        isRead: true
      }
    });
  }

  const notificationSamples: {
    receiverId: string;
    senderId?: string;
    message: string;
    path: string;
    type: NotificationType;
    isRead?: boolean;
  }[] = [
    {
      receiverId: driverAuthUserIds[0],
      senderId: customerAuthUserIds[0],
      message: "새로운 견적 요청이 도착했어요.",
      path: "/driver/received-requests",
      type: NotificationType.ESTIMATE_REQUEST
    },
    {
      receiverId: driverAuthUserIds[1],
      senderId: customerAuthUserIds[1],
      message: "고객님이 기사님을 지정 요청했어요.",
      path: "/driver/received-requests",
      type: NotificationType.DESIGNATED_REQUEST
    },
    {
      receiverId: customerAuthUserIds[0],
      senderId: driverAuthUserIds[0],
      message: "기사님이 견적을 제안했어요.",
      path: "/customer/my-estimates/estimate-pending",
      type: NotificationType.ESTIMATE_PROPOSAL
    },
    {
      receiverId: driverAuthUserIds[0],
      senderId: customerAuthUserIds[0],
      message: "고객님이 견적을 수락했어요.",
      path: "/driver/my-estimates/sent",
      type: NotificationType.ESTIMATE_ACCEPTED,
      isRead: true
    },
    {
      receiverId: customerAuthUserIds[1],
      senderId: driverAuthUserIds[1],
      message: "기사님이 견적을 반려했어요.",
      path: "/customer/my-estimates/estimate-pending",
      type: NotificationType.ESTIMATE_REJECTED
    },
    {
      receiverId: customerAuthUserIds[0],
      senderId: driverAuthUserIds[0],
      message: "이사가 확정되었어요.",
      path: "/customer/my-estimates/estimate-past",
      type: NotificationType.MOVE_CONFIRMED
    },
    {
      receiverId: customerAuthUserIds[0],
      message: "이사가 완료되었어요.",
      path: "/customer/my-estimates/estimate-past",
      type: NotificationType.MOVE_COMPLETED,
      isRead: true
    },
    {
      receiverId: driverAuthUserIds[0],
      message: "내일은 이사 예정일이에요.",
      path: "/driver/my-estimates/sent",
      type: NotificationType.MOVE_DAY_REMINDER
    },
    {
      receiverId: customerAuthUserIds[0],
      message: "이사는 어떠셨나요? 리뷰를 남겨주세요.",
      path: "/customer/my-estimates/estimate-past",
      type: NotificationType.REVIEW_REQUESTED
    },
    {
      receiverId: driverAuthUserIds[0],
      senderId: customerAuthUserIds[0],
      message: "새로운 리뷰가 등록됐어요.",
      path: "/driver/my-estimates/sent",
      type: NotificationType.REVIEW_RECEIVED
    },
    {
      receiverId: customerAuthUserIds[2],
      senderId: driverAuthUserIds[2],
      message: "이사 관련 문의드립니다.",
      path: "/customer/my-estimates/estimate-pending",
      type: NotificationType.MESSAGE
    }
  ];

  for (const notification of notificationSamples) {
    await prisma.notification.create({ data: notification });
  }
  console.log("🌱 알림 생성 완료 (NotificationType 12종 전부 포함)");

  console.log("🌱 랜덤 시드 완료");
  console.log("\n🔑 테스트 로그인 계정 (전부 비밀번호 동일: 1q2w3e4r!)");
  console.log("   고객: customer1@test.com ~ customer10@test.com");
  console.log("   기사: driver1@test.com ~ driver10@test.com");
  console.log("   예) 고객1 로그인 → customer1@test.com / 1q2w3e4r!");
  console.log("   예) 기사1 로그인 → driver1@test.com / 1q2w3e4r!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
