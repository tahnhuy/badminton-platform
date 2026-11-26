"""Mô phỏng Hướng B — điểm phong độ liên tục (Elo trên thang 0–100 của khảo sát) + vùng đệm.
Báo cáo: docs/research/bao-cao-cong-thuc-nang-trinh.md §3.
Chạy: python3 -I mo_phong_diem_phong_do.py  (chỉ dùng thư viện chuẩn; in độ chính xác, flips, bias theo bộ tham số).
"""
import random, statistics as st
BANDS=[0,15,30,45,60,70,80]
MID={1:7.5,2:22.5,3:37.5,4:52.5,5:65,6:75,7:90}
def band(x): 
    r=1
    for i,b in enumerate(BANDS):
        if x>=b: r=i+1
    return r
def lvl_hyst(cur,R,h):
    # move up only if R >= lower bound of next band + h; down only if R < lower bound of current band - h
    while cur<7 and R>=BANDS[cur]+h: cur+=1
    while cur>1 and R<BANDS[cur-1]-h: cur-=1
    return cur
def true_score(t):  # continuous true rank -> rating scale via interpolation of mids
    lo=int(t); hi=lo+1; f=t-lo
    return MID[max(1,min(7,lo))]*(1-f)+MID[max(1,min(7,hi))]*f
def run(seed,K=4.0,Kt=8.0,D=15,h=3,tent_matches=6,bonus=(0,0),n_players=200,n_events=300,scale=0.7,noise_sd=0):
    rnd=random.Random(seed); P=[]
    for i in range(n_players):
        true=rnd.choice([2,3,3,4,4,4,5,5,6])+rnd.uniform(-0.4,0.4)
        e=rnd.random()
        err= 0 if e<0.55 else (1 if e<0.8 else -1) if e<0.95 else (2 if e<0.975 else -2)
        lvl=max(1,min(7,round(true)+err))
        R=MID[lvl]+rnd.uniform(-4,4)   # survey score inside the band
        P.append(dict(true=true,R=R,lvl=lvl,lvl0=lvl,n=0,changes=0,flips=0,last=None))
    for ev in range(n_events):
        c=rnd.randint(2,6); pool=[p for p in P if c-1<=p['lvl']<=c+1]
        if len(pool)<8: continue
        n=16 if len(pool)>=16 else 8
        ent=rnd.sample(pool,n); alive=ent[:]; rnd.shuffle(alive)
        while len(alive)>1:
            nxt=[]
            for a,b in zip(alive[::2],alive[1::2]):
                pa=1/(1+10**(-(a['true']-b['true'])/scale))
                w,l=(a,b) if rnd.random()<pa else (b,a)
                Ew=1/(1+10**((l['R']-w['R'])/D))
                kw=Kt if w['n']<tent_matches else K; kl=Kt if l['n']<tent_matches else K
                w['R']+=kw*(1-Ew); l['R']-=kl*(1-Ew)
                w['n']+=1; l['n']+=1; nxt.append(w)
            alive=nxt
        for p in ent:
            new=lvl_hyst(p['lvl'],p['R'],h)
            if new!=p['lvl']:
                d=1 if new>p['lvl'] else -1
                if p['last'] is not None and d!=p['last']: p['flips']+=1
                p['last']=d; p['changes']+=1; p['lvl']=new
    acc=st.mean(p['lvl']==round(p['true']) for p in P); acc0=st.mean(p['lvl0']==round(p['true']) for p in P)
    return acc,acc0,st.mean(abs(p['lvl']-p['true']) for p in P),st.mean(p['flips'] for p in P),st.mean(p['changes'] for p in P),st.mean(p['lvl']-p['true'] for p in P),st.mean(p['n'] for p in P)
for K,Kt,D,h in [(4,8,15,3),(3,6,15,3),(4,8,15,0),(4,8,12,3),(6,12,15,3),(2,6,15,2),(3,8,15,2)]:
    rs=[run(s,K,Kt,D,h) for s in range(15)]
    m=[st.mean(x[i] for x in rs) for i in range(7)]
    print(f"K={K} Kt={Kt} D={D} h={h}: acc={m[0]:.3f} (survey {m[1]:.3f}) mae={m[2]:.3f} flips={m[3]:.3f} changes={m[4]:.2f} bias={m[5]:+.2f} matches/player={m[6]:.1f}")
