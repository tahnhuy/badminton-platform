"""Mô phỏng thêm thưởng thứ hạng vào điểm phong độ (cố định / theo kỳ vọng) — bị loại vì gây lệch bậc.
Báo cáo: docs/research/bao-cao-cong-thuc-nang-trinh.md §4.2b. Chạy: python3 -I mo_phong_thuong_thu_hang.py
"""
import random, statistics as st, math
BANDS=[0,15,30,45,60,70,80]; MID={1:7.5,2:22.5,3:37.5,4:52.5,5:65,6:75,7:90}
def lvl_hyst(cur,R,h):
    while cur<7 and R>=BANDS[cur]+h: cur+=1
    while cur>1 and R<BANDS[cur-1]-h: cur-=1
    return cur
def E(a,b,D=15): return 1/(1+10**((b-a)/D))
def run(seed,mode,B=3.0,KP=1.0,K=3,Kt=6,h=3,tm=6,n_players=200,n_events=300,scale=0.7):
    rnd=random.Random(seed); P=[]
    for i in range(n_players):
        true=rnd.choice([2,3,3,4,4,4,5,5,6])+rnd.uniform(-0.4,0.4); e=rnd.random()
        err= 0 if e<0.55 else (1 if e<0.8 else -1) if e<0.95 else (2 if e<0.975 else -2)
        lvl=max(1,min(7,round(true)+err)); R=MID[lvl]+rnd.uniform(-4,4)
        P.append(dict(true=true,R=R,lvl=lvl,lvl0=lvl,n=0,flips=0,last=None,champ_up=0,champs=0))
    for ev in range(n_events):
        c=rnd.randint(2,6); pool=[p for p in P if c-1<=p['lvl']<=c+1]
        if len(pool)<8: continue
        n=16 if len(pool)>=16 else 8
        ent=rnd.sample(pool,n); R0={id(p):p['R'] for p in ent}
        # expected rounds won: sum over opponents approx = (rounds) * avg win prob vs field -> use geometric approx
        rounds=int(math.log2(n))
        exp_wins={}
        for p in ent:
            pw=st.mean(E(R0[id(p)],R0[id(q)]) for q in ent if q is not p)
            # expected number of consecutive wins capped at rounds
            exp_wins[id(p)]=sum(pw**k for k in range(1,rounds+1))
        wins={id(p):0 for p in ent}
        alive=ent[:]; rnd.shuffle(alive)
        while len(alive)>1:
            nxt=[]
            for a,b in zip(alive[::2],alive[1::2]):
                pa=1/(1+10**(-(a['true']-b['true'])/scale))
                w,l=(a,b) if rnd.random()<pa else (b,a)
                Ew=E(w['R'],l['R'])
                kw=Kt if w['n']<tm else K; kl=Kt if l['n']<tm else K
                w['R']+=kw*(1-Ew); l['R']-=kl*(1-Ew); w['n']+=1; l['n']+=1; wins[id(w)]+=1; nxt.append(w)
            alive=nxt
        champ=alive[0]; fieldR=st.mean(R0.values())
        for p in ent:
            k=Kt if p['n']<=tm else K
            if mode=='fixed':
                place_bonus={rounds:B,rounds-1:B/2}.get(wins[id(p)],0)
                F=max(0.5,min(1.5,1+(fieldR-R0[id(p)])/15))
                p['R']+=place_bonus*F
            elif mode=='expected':
                p['R']+=KP*(k/3)*(wins[id(p)]-exp_wins[id(p)])
        for p in ent:
            old=p['lvl']; new=lvl_hyst(old,p['R'],h)
            if p is champ: p['champs']+=1; p['champ_up']+= new>old
            if new!=old:
                d=1 if new>old else -1
                if p['last'] is not None and d!=p['last']: p['flips']+=1
                p['last']=d; p['lvl']=new
    acc=st.mean(p['lvl']==round(p['true']) for p in P)
    champ_up=sum(p['champ_up'] for p in P)/max(1,sum(p['champs'] for p in P))
    return acc,st.mean(p['flips'] for p in P),st.mean(p['lvl']-p['true'] for p in P),st.mean(p['R'] for p in P),champ_up
for label,mode,kw in [('no bonus','none',{}),('fixed B=3','fixed',dict(B=3)),('fixed B=5','fixed',dict(B=5)),('expected KP=1','expected',dict(KP=1)),('expected KP=2','expected',dict(KP=2)),('expected KP=3','expected',dict(KP=3))]:
    for ev in (40,300):
        rs=[run(s,mode,n_events=ev,**kw) for s in range(15)]
        m=[st.mean(x[i] for x in rs) for i in range(5)]
        print(f"{label:14s} events={ev:3d} acc={m[0]:.3f} flips={m[1]:.3f} bias={m[2]:+.2f} meanR={m[3]:.1f} champ->promoted={m[4]:.0%}")
