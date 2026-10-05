import React from 'react';
import { PlayerLayout } from '../components/PlayerLayout';
import {
  CourtIcon,
  UsersIcon,
  TournamentIcon,
  ShuttlecockIcon,
  ChevronRightIcon,
  CheckShieldIcon,
  BellIcon,
} from '../../../components/common/Icons';

export const PlayerHomePage: React.FC = () => {
  return (
    <PlayerLayout>
      <div
        style={{
          width: '100%',
          maxWidth: 1440,
          margin: '0 auto',
          padding: '32px 24px 64px',
          display: 'flex',
          flexDirection: 'column',
          gap: 28,
        }}
      >
        {/* ================= 1. Top Breadcrumb & Technical Status Tracker ================= */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          {/* Breadcrumb path */}
          <nav
            aria-label="Breadcrumb"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 13,
              fontFamily: 'Inter, sans-serif',
            }}
          >
            <a
              href="/"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                color: 'var(--text-secondary, #505F76)',
                textDecoration: 'none',
              }}
            >
              Trang chủ
            </a>
            <span style={{ color: 'rgba(189, 202, 186, 0.8)' }}>/</span>
            <span style={{ color: 'var(--text-secondary, #505F76)' }}>
              Hoạt động của tôi
            </span>
            <span style={{ color: 'rgba(189, 202, 186, 0.8)' }}>/</span>
            <span
              style={{
                color: 'var(--text-primary, #131B2E)',
                fontWeight: 600,
              }}
            >
              Trạng thái dữ liệu (P77)
            </span>
          </nav>

          {/* Status Tracker Badge */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 12px',
              borderRadius: 9999,
              backgroundColor: '#E2E7FF',
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: '#98DA27',
                display: 'inline-block',
              }}
            />
            <span
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'var(--text-tag-uid, #3E4A3D)',
              }}
            >
              SYSTEM_STATE • EMPTY_CONTAINER
            </span>
          </div>
        </div>

        {/* ================= 2. Hero Header Banner ================= */}
        <div
          style={{
            position: 'relative',
            backgroundColor: '#FFFFFF',
            borderRadius: 16,
            padding: '36px 32px',
            border: '1px solid rgba(189, 202, 186, 0.35)',
            boxShadow: 'var(--shadow-sm, 0px 1px 2px 0px rgba(0, 0, 0, 0.05))',
            overflow: 'hidden',
          }}
        >
          {/* Subtle Ambient Glow */}
          <div
            style={{
              position: 'absolute',
              top: -60,
              right: -60,
              width: 320,
              height: 320,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(0, 107, 44, 0.12) 0%, rgba(178, 247, 70, 0.15) 50%, rgba(178, 247, 70, 0) 100%)',
              filter: 'blur(30px)',
              pointerEvents: 'none',
            }}
          />

          <div style={{ position: 'relative', zIndex: 1, maxWidth: 720 }}>
            <div
              style={{
                display: 'inline-block',
                padding: '3px 10px',
                borderRadius: 8,
                backgroundColor: 'var(--bg-tag-owner, #D0E1FB)',
                marginBottom: 12,
              }}
            >
              <span
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 700,
                  fontSize: 11,
                  lineHeight: '14px',
                  letterSpacing: '0.04em',
                  color: 'var(--color-owner-badge, #0B1C30)',
                }}
              >
                TÀI KHOẢN MỚI KÍCH HOẠT
              </span>
            </div>

            <h1
              style={{
                fontFamily: 'Inter, sans-serif',
                fontWeight: 700,
                fontSize: 30,
                lineHeight: '38px',
                letterSpacing: '-0.025em',
                color: 'var(--text-primary, #131B2E)',
                marginBottom: 12,
              }}
            >
              Chưa có hoạt động thể thao nào được ghi nhận
            </h1>

            <p
              style={{
                fontFamily: 'Inter, sans-serif',
                fontWeight: 400,
                fontSize: 15,
                lineHeight: '23px',
                color: 'var(--text-secondary, #505F76)',
                margin: 0,
              }}
            >
              Chào mừng bạn gia nhập hệ sinh thái SmashPro. Bạn chưa phát sinh lịch đặt sân, trận đấu giao hữu ghép cặp hoặc đăng ký tham gia giải đấu chính thức nào.
            </p>
          </div>
        </div>

        {/* ================= 3. Central Visual Empty State Card ================= */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 16,
            padding: '40px 32px',
            border: '1px solid rgba(189, 202, 186, 0.35)',
            boxShadow: 'var(--shadow-sm, 0px 1px 2px 0px rgba(0, 0, 0, 0.05))',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
          }}
        >
          {/* Emblem & Ambient Icon Graphic */}
          <div
            style={{
              position: 'relative',
              width: 120,
              height: 120,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 24,
            }}
          >
            {/* Background Glow */}
            <div
              style={{
                position: 'absolute',
                width: 100,
                height: 100,
                borderRadius: '50%',
                backgroundColor: 'rgba(127, 252, 151, 0.35)',
                filter: 'blur(16px)',
              }}
            />

            {/* Container Box */}
            <div
              style={{
                position: 'relative',
                width: 88,
                height: 88,
                borderRadius: 20,
                backgroundColor: 'var(--bg-table-header, #F2F3FF)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0px 4px 10px rgba(0, 0, 0, 0.06)',
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 14,
                  backgroundColor: 'var(--color-brand, #006B2C)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFFFFF',
                }}
              >
                <ShuttlecockIcon size={32} color="#FFFFFF" />
              </div>

              {/* Mini Accent badge */}
              <div
                style={{
                  position: 'absolute',
                  bottom: -6,
                  right: -6,
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  backgroundColor: '#B2F746',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 6px rgba(0, 0, 0, 0.1)',
                  color: '#121F00',
                  fontWeight: 700,
                  fontSize: 16,
                }}
              >
                ⚡
              </div>
            </div>
          </div>

          <h2
            style={{
              fontFamily: 'Inter, sans-serif',
              fontWeight: 700,
              fontSize: 22,
              lineHeight: '30px',
              letterSpacing: '-0.015em',
              color: 'var(--text-primary, #131B2E)',
              marginBottom: 10,
            }}
          >
            Khởi đầu đam mê cầu lông cùng SmashPro!
          </h2>

          <p
            style={{
              fontFamily: 'Inter, sans-serif',
              fontWeight: 400,
              fontSize: 14,
              lineHeight: '22px',
              color: 'var(--text-tag-uid, #3E4A3D)',
              maxWidth: 620,
              marginBottom: 28,
            }}
          >
            Tài khoản của bạn đã sẵn sàng nhập cuộc. Hãy tham gia ngay để trải nghiệm đặt sân siêu tốc, kết nối đối thủ cùng trình độ và thử sức ở các giải đấu đỉnh cao diễn ra hàng tuần.
          </p>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 12,
              justifyContent: 'center',
            }}
          >
            <button
              type="button"
              style={{
                padding: '11px 24px',
                borderRadius: 8,
                backgroundColor: 'var(--color-brand, #006B2C)',
                color: '#FFFFFF',
                fontWeight: 600,
                fontSize: 14,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: 'var(--shadow-sm, 0px 1px 2px 0px rgba(0,0,0,0.05))',
                cursor: 'pointer',
              }}
            >
              <span>Khám phá hành trình mới</span>
              <ChevronRightIcon size={14} color="#FFFFFF" />
            </button>

            <button
              type="button"
              style={{
                padding: '11px 20px',
                borderRadius: 8,
                backgroundColor: 'var(--bg-tag-uid, #EAEDFF)',
                color: 'var(--text-primary, #131B2E)',
                fontWeight: 600,
                fontSize: 14,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
              }}
            >
              Chia sẻ mã ID người chơi
            </button>
          </div>
        </div>

        {/* ================= 4. 3 Quick Starter Action Cards ================= */}
        <div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              gap: 12,
              marginBottom: 16,
            }}
          >
            <div>
              <span
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 700,
                  fontSize: 11,
                  lineHeight: '14px',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  color: 'var(--color-brand, #006B2C)',
                  display: 'block',
                  marginBottom: 4,
                }}
              >
                HÀNH ĐỘNG GỢI Ý
              </span>
              <h3
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 600,
                  fontSize: 20,
                  lineHeight: '28px',
                  letterSpacing: '-0.01em',
                  color: 'var(--text-primary, #131B2E)',
                  margin: 0,
                }}
              >
                3 bước khởi động thi đấu lý tưởng
              </h3>
            </div>
            <span
              style={{
                fontSize: 12,
                color: 'var(--text-secondary, #505F76)',
                fontWeight: 500,
              }}
            >
              Hoàn tất bất kỳ hoạt động nào để cập nhật hồ sơ
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: 20,
            }}
          >
            {/* Card 1: Booking */}
            <div
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 14,
                padding: '24px',
                border: '1px solid rgba(189, 202, 186, 0.35)',
                boxShadow: 'var(--shadow-sm, 0px 1px 2px 0px rgba(0, 0, 0, 0.05))',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 16,
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      backgroundColor: 'rgba(0, 107, 44, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--color-brand, #006B2C)',
                    }}
                  >
                    <CourtIcon size={22} color="var(--color-brand, #006B2C)" />
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 4,
                      backgroundColor: 'var(--bg-tag-uid, #EAEDFF)',
                      color: 'var(--text-secondary, #505F76)',
                    }}
                  >
                    Mã P06
                  </span>
                </div>

                <h4
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 700,
                    fontSize: 17,
                    lineHeight: '24px',
                    color: 'var(--text-primary, #131B2E)',
                    marginBottom: 8,
                  }}
                >
                  Đặt sân cầu lông đầu tiên
                </h4>
                <p
                  style={{
                    fontSize: 13,
                    lineHeight: '19px',
                    color: 'var(--text-tag-uid, #3E4A3D)',
                    marginBottom: 16,
                  }}
                >
                  Tìm kiếm hơn 120 cụm sân uy tín, đặt chỗ giữ sân thời gian thực chỉ trong 30 giây với thanh toán QR linh hoạt.
                </p>

                <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary, #505F76)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <CheckShieldIcon size={13} color="var(--color-brand, #006B2C)" /> Giữ sân tức thì
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary, #505F76)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <CheckShieldIcon size={13} color="var(--color-brand, #006B2C)" /> Chuẩn thảm BWF
                  </span>
                </div>
              </div>

              <button
                type="button"
                style={{
                  width: '100%',
                  padding: '10px 16px',
                  borderRadius: 8,
                  backgroundColor: 'var(--color-brand, #006B2C)',
                  color: '#FFFFFF',
                  fontWeight: 600,
                  fontSize: 13.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  cursor: 'pointer',
                }}
              >
                <span>Khám phá sân gần bạn</span>
                <ChevronRightIcon size={14} color="#FFFFFF" />
              </button>
            </div>

            {/* Card 2: Matchmaking */}
            <div
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 14,
                padding: '24px',
                border: '1px solid rgba(189, 202, 186, 0.35)',
                boxShadow: 'var(--shadow-sm, 0px 1px 2px 0px rgba(0, 0, 0, 0.05))',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 16,
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      backgroundColor: 'rgba(67, 102, 0, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--color-warning, #436600)',
                    }}
                  >
                    <UsersIcon size={22} color="var(--color-warning, #436600)" />
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 4,
                      backgroundColor: 'var(--bg-tag-uid, #EAEDFF)',
                      color: 'var(--text-secondary, #505F76)',
                    }}
                  >
                    Mã P19
                  </span>
                </div>

                <h4
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 700,
                    fontSize: 17,
                    lineHeight: '24px',
                    color: 'var(--text-primary, #131B2E)',
                    marginBottom: 8,
                  }}
                >
                  Tìm bạn cùng chơi & Ghép cặp
                </h4>
                <p
                  style={{
                    fontSize: 13,
                    lineHeight: '19px',
                    color: 'var(--text-tag-uid, #3E4A3D)',
                    marginBottom: 16,
                  }}
                >
                  Hệ thống SmartMatch tìm bạn đấu đơn / đôi theo đúng trình độ ELO và bán kính vị trí địa lý thuận tiện nhất.
                </p>

                <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary, #505F76)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <CheckShieldIcon size={13} color="var(--color-warning, #436600)" /> Phù hợp ELO
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary, #505F76)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <CheckShieldIcon size={13} color="var(--color-warning, #436600)" /> Đánh đơn & Đôi
                  </span>
                </div>
              </div>

              <button
                type="button"
                style={{
                  width: '100%',
                  padding: '10px 16px',
                  borderRadius: 8,
                  backgroundColor: 'var(--color-brand, #006B2C)',
                  color: '#FFFFFF',
                  fontWeight: 600,
                  fontSize: 13.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  cursor: 'pointer',
                }}
              >
                <span>Tạo yêu cầu ghép trận</span>
                <ChevronRightIcon size={14} color="#FFFFFF" />
              </button>
            </div>

            {/* Card 3: Tournaments */}
            <div
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 14,
                padding: '24px',
                border: '1px solid rgba(189, 202, 186, 0.35)',
                boxShadow: 'var(--shadow-sm, 0px 1px 2px 0px rgba(0, 0, 0, 0.05))',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 16,
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      backgroundColor: 'var(--bg-tag-owner, #D0E1FB)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--color-owner-badge, #0B1C30)',
                    }}
                  >
                    <TournamentIcon size={22} color="var(--color-owner-badge, #0B1C30)" />
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 4,
                      backgroundColor: 'var(--bg-tag-uid, #EAEDFF)',
                      color: 'var(--text-secondary, #505F76)',
                    }}
                  >
                    Mã P26
                  </span>
                </div>

                <h4
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 700,
                    fontSize: 17,
                    lineHeight: '24px',
                    color: 'var(--text-primary, #131B2E)',
                    marginBottom: 8,
                  }}
                >
                  Ghi danh giải đấu phong trào
                </h4>
                <p
                  style={{
                    fontSize: 13,
                    lineHeight: '19px',
                    color: 'var(--text-tag-uid, #3E4A3D)',
                    marginBottom: 16,
                  }}
                >
                  Thử thách bản thân tại các giải cúp mở rộng từ hạng Sơ cấp đến Bán chuyên có tính điểm xếp hạng VBF.
                </p>

                <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary, #505F76)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <CheckShieldIcon size={13} color="var(--color-brand, #006B2C)" /> Chứng chỉ điện tử
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary, #505F76)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <CheckShieldIcon size={13} color="var(--color-brand, #006B2C)" /> Livestream tỷ số
                  </span>
                </div>
              </div>

              <button
                type="button"
                style={{
                  width: '100%',
                  padding: '10px 16px',
                  borderRadius: 8,
                  backgroundColor: 'var(--color-brand, #006B2C)',
                  color: '#FFFFFF',
                  fontWeight: 600,
                  fontSize: 13.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  cursor: 'pointer',
                }}
              >
                <span>Xem lịch giải đấu</span>
                <ChevronRightIcon size={14} color="#FFFFFF" />
              </button>
            </div>
          </div>
        </div>

        {/* ================= 5. Helpful Tips & Feature Highlights Bento ================= */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
            gap: 20,
          }}
        >
          {/* Tip 1 */}
          <div
            style={{
              backgroundColor: 'var(--bg-table-header, #F2F3FF)',
              borderRadius: 14,
              padding: '24px',
              display: 'flex',
              gap: 16,
              alignItems: 'flex-start',
            }}
          >
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 10,
                backgroundColor: '#FFFFFF',
                boxShadow: 'var(--shadow-sm, 0px 1px 2px 0px rgba(0, 0, 0, 0.05))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-brand, #006B2C)',
                flexShrink: 0,
              }}
            >
              <UsersIcon size={20} color="var(--color-brand, #006B2C)" />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 700,
                    fontSize: 15,
                    color: 'var(--text-primary, #131B2E)',
                  }}
                >
                  Hoàn thiện hồ sơ & ELO cá nhân (P44)
                </span>
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 9999,
                    backgroundColor: '#7FFC97',
                    color: '#002109',
                  }}
                >
                  +20% ghép nhanh
                </span>
              </div>
              <p
                style={{
                  fontSize: 13,
                  lineHeight: '18px',
                  color: 'var(--text-secondary, #505F76)',
                  margin: 0,
                }}
              >
                Cập nhật thói quen tay vợt thuận, vị trí thi đấu yêu thích và lịch sử chơi cầu lông để nhận đề xuất đối thủ tương đồng.
              </p>
              <a
                href="#profile"
                style={{
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: 'var(--color-brand, #006B2C)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  marginTop: 4,
                  textDecoration: 'none',
                }}
              >
                Cập nhật ELO của bạn &rarr;
              </a>
            </div>
          </div>

          {/* Tip 2 */}
          <div
            style={{
              backgroundColor: 'var(--bg-table-header, #F2F3FF)',
              borderRadius: 14,
              padding: '24px',
              display: 'flex',
              gap: 16,
              alignItems: 'flex-start',
            }}
          >
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 10,
                backgroundColor: '#FFFFFF',
                boxShadow: 'var(--shadow-sm, 0px 1px 2px 0px rgba(0, 0, 0, 0.05))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-warning, #436600)',
                flexShrink: 0,
              }}
            >
              <BellIcon size={20} color="var(--color-warning, #436600)" />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 700,
                    fontSize: 15,
                    color: 'var(--text-primary, #131B2E)',
                  }}
                >
                  Bật thông báo giờ vàng sân trống
                </span>
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 9999,
                    backgroundColor: '#B2F746',
                    color: '#121F00',
                  }}
                >
                  Tiết kiệm 15%
                </span>
              </div>
              <p
                style={{
                  fontSize: 13,
                  lineHeight: '18px',
                  color: 'var(--text-secondary, #505F76)',
                  margin: 0,
                }}
              >
                Nhận chuông báo tự động ngay khi có người chơi hủy lịch sân đẹp khung giờ 18:00 - 21:00 tại cụm sân gần bạn.
              </p>
              <a
                href="#notifications"
                style={{
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: 'var(--color-brand, #006B2C)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  marginTop: 4,
                  textDecoration: 'none',
                }}
              >
                Cài đặt thông báo tùy chỉnh &rarr;
              </a>
            </div>
          </div>
        </div>

        {/* ================= 6. Club Community Preview Banner ================= */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 14,
            padding: '24px 28px',
            border: '1px solid rgba(189, 202, 186, 0.35)',
            boxShadow: 'var(--shadow-sm, 0px 1px 2px 0px rgba(0, 0, 0, 0.05))',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 20,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                backgroundColor: 'var(--bg-tag-uid, #EAEDFF)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-brand, #006B2C)',
                flexShrink: 0,
              }}
            >
              <ShuttlecockIcon size={24} color="var(--color-brand, #006B2C)" />
            </div>
            <div>
              <h4
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 700,
                  fontSize: 16,
                  lineHeight: '22px',
                  color: 'var(--text-primary, #131B2E)',
                  margin: 0,
                }}
              >
                Cần giải đáp hoặc tìm hội nhóm cố định hàng tuần?
              </h4>
              <p
                style={{
                  fontSize: 13,
                  lineHeight: '18px',
                  color: 'var(--text-secondary, #505F76)',
                  margin: '4px 0 0',
                }}
              >
                Ghé thăm bảng tin CLB SmashPro để giao lưu cùng hơn 18,000 tay vợt phong trào trên cả nước.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              style={{
                padding: '8px 18px',
                borderRadius: 8,
                backgroundColor: 'var(--bg-tag-uid, #EAEDFF)',
                color: 'var(--text-primary, #131B2E)',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Trung tâm trợ giúp
            </button>
            <button
              type="button"
              style={{
                padding: '8px 18px',
                borderRadius: 8,
                backgroundColor: 'var(--color-brand, #006B2C)',
                color: '#FFFFFF',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Tham gia nhóm Zalo CLB
            </button>
          </div>
        </div>
      </div>
    </PlayerLayout>
  );
};
