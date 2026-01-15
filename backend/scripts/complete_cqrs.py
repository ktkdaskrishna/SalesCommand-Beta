"""
Complete CQRS Setup with UUID Unification
Fixes all identity and relationship issues
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
import uuid as uuid_lib

async def complete_cqrs_setup():
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client['test_database']
    
    print("="*80)
    print("COMPLETING CQRS SETUP - UUID UNIFICATION")
    print("="*80)
    
    # STEP 1: Build email → auth UUID mapping
    print("\nStep 1: Building email → UUID mapping from auth...")
    auth_users = await db.users.find({}, {"_id": 0, "id": 1, "email": 1, "is_super_admin": 1}).to_list(100)
    email_to_auth_uuid = {u['email'].lower(): u for u in auth_users}
    print(f"   ✅ Mapped {len(email_to_auth_uuid)} auth users")
    
    # STEP 2: Clear and rebuild user_profiles with AUTH UUIDs
    print("\nStep 2: Rebuilding user_profiles with auth UUIDs...")
    await db.user_profiles.delete_many({})
    
    users_raw = await db.odoo_raw_data.find({
        "entity_type": "user",
        "is_latest": True,
        "raw_data.odoo_employee_id": {"$ne": None}
    }).to_list(100)
    
    created_profiles = {}
    
    for user_raw in users_raw:
        data = user_raw.get('raw_data', {})
        email = (data.get('email') or '').lower().strip()
        
        if not email:
            continue
        
        # Use auth UUID if exists
        auth_user = email_to_auth_uuid.get(email)
        if auth_user:
            user_id = auth_user['id']
            is_super_admin = auth_user.get('is_super_admin', False)
        else:
            user_id = str(uuid_lib.uuid4())
            is_super_admin = False
        
        odoo_employee_id = data.get('odoo_employee_id')
        created_profiles[odoo_employee_id] = {
            'user_id': user_id,
            'email': email,
            'name': data.get('name'),
            'odoo_user_id': data.get('odoo_user_id'),
            'odoo_employee_id': odoo_employee_id,
            'manager_odoo_id': data.get('manager_odoo_id'),
            'is_super_admin': is_super_admin
        }
    
    print(f"   ✅ Prepared {len(created_profiles)} user profiles")
    
    # STEP 3: Build hierarchy relationships
    print("\nStep 3: Building hierarchy relationships...")
    for emp_id, user_info in created_profiles.items():
        # Find subordinates
        subordinates = []
        for other_emp_id, other_info in created_profiles.items():
            if other_info['manager_odoo_id'] == emp_id:
                subordinates.append({
                    "user_id": other_info['user_id'],
                    "odoo_employee_id": other_emp_id,
                    "odoo_user_id": other_info['odoo_user_id'],
                    "name": other_info['name'],
                    "email": other_info['email']
                })
        
        # Find manager
        manager = None
        manager_odoo_id = user_info['manager_odoo_id']
        if manager_odoo_id and manager_odoo_id in created_profiles:
            mgr_info = created_profiles[manager_odoo_id]
            manager = {
                "user_id": mgr_info['user_id'],
                "odoo_employee_id": manager_odoo_id,
                "name": mgr_info['name'],
                "email": mgr_info['email']
            }
        
        # Insert user_profile
        await db.user_profiles.insert_one({
            "id": user_info['user_id'],
            "email": user_info['email'],
            "name": user_info['name'],
            "odoo": {
                "user_id": user_info['odoo_user_id'],
                "employee_id": emp_id,
                "salesperson_name": user_info['name'],
                "manager_employee_id": manager_odoo_id
            },
            "hierarchy": {
                "manager": manager,
                "subordinates": subordinates,
                "reports_count": len(subordinates),
                "is_manager": len(subordinates) > 0
            },
            "is_super_admin": user_info['is_super_admin'],
            "last_sync": datetime.now(timezone.utc),
            "source": "odoo",
            "version": 1
        })
        
        print(f"   ✅ {user_info['email']:<40} | ID: {user_info['user_id'][:8]}... | Subs: {len(subordinates)}")
    
    # STEP 4: Rebuild opportunities with correct visibility
    print("\nStep 4: Rebuilding opportunities with visibility...")
    await db.opportunity_view.delete_many({})
    
    opps_raw = await db.odoo_raw_data.find({
        "entity_type": "opportunity",
        "is_latest": True
    }).to_list(1000)
    
    opp_count = 0
    for opp_raw in opps_raw:
        data = opp_raw.get('raw_data', {})
        odoo_id = data.get('id')
        
        if not odoo_id:
            continue
        
        # Find salesperson by odoo_user_id
        sp_odoo_user_id = data.get('salesperson_id')
        salesperson = None
        visible_to = set()
        
        if sp_odoo_user_id:
            # Find user with this odoo_user_id
            sp_profile = await db.user_profiles.find_one({"odoo.user_id": sp_odoo_user_id})
            
            if sp_profile:
                salesperson = {
                    "user_id": sp_profile["id"],
                    "odoo_user_id": sp_profile["odoo"]["user_id"],
                    "odoo_employee_id": sp_profile["odoo"]["employee_id"],
                    "name": sp_profile["name"],
                    "email": sp_profile["email"],
                    "manager": sp_profile.get("hierarchy", {}).get("manager")
                }
                
                # Owner can see
                visible_to.add(sp_profile["id"])
                
                # Manager can see
                mgr = salesperson.get("manager")
                if mgr:
                    visible_to.add(mgr["user_id"])
            else:
                # Try fallback: match by email in salesperson_name
                sp_name = data.get('salesperson_name', '').lower()
                if '@' in sp_name:
                    sp_profile = await db.user_profiles.find_one({"email": sp_name})
                    if sp_profile:
                        salesperson = {
                            "user_id": sp_profile["id"],
                            "name": sp_profile["name"],
                            "email": sp_profile["email"]
                        }
                        visible_to.add(sp_profile["id"])
        
        # Add all super admins
        admins = await db.user_profiles.find({"is_super_admin": True}).to_list(100)
        for admin in admins:
            visible_to.add(admin["id"])
        
        # Insert opportunity
        await db.opportunity_view.insert_one({
            "id": str(uuid_lib.uuid4()),
            "odoo_id": odoo_id,
            "name": data.get('name'),
            "stage": data.get('stage_name', 'New'),
            "value": float(data.get('expected_revenue', 0) or 0),
            "probability": float(data.get('probability', 0) or 0),
            "expected_close_date": data.get('date_deadline'),
            "description": data.get('description'),
            "salesperson": salesperson,
            "account": None,  # TODO: Link accounts
            "visible_to_user_ids": list(visible_to),
            "is_active": True,
            "last_synced": datetime.now(timezone.utc),
            "source": "odoo",
            "version": 1
        })
        
        opp_count += 1
    
    print(f"   ✅ Created {opp_count} opportunities")
    
    # STEP 5: Rebuild access matrices
    print("\nStep 5: Rebuilding access matrices...")
    await db.user_access_matrix.delete_many({})
    
    all_profiles = await db.user_profiles.find({}).to_list(100)
    
    for profile in all_profiles:
        user_id = profile['id']
        email = profile['email']
        is_super_admin = profile.get('is_super_admin', False)
        
        # Find accessible opportunities
        if is_super_admin:
            opps = await db.opportunity_view.find(
                {"is_active": True}
            ).to_list(10000)
        else:
            opps = await db.opportunity_view.find({
                "visible_to_user_ids": user_id,
                "is_active": True
            }).to_list(10000)
        
        subordinates = profile.get('hierarchy', {}).get('subordinates', [])
        
        await db.user_access_matrix.insert_one({
            "user_id": user_id,
            "email": email,
            "accessible_opportunities": [o["odoo_id"] for o in opps],
            "accessible_accounts": [],
            "accessible_user_ids": [s["user_id"] for s in subordinates],
            "is_super_admin": is_super_admin,
            "is_manager": len(subordinates) > 0,
            "subordinate_count": len(subordinates),
            "managed_team_ids": [],
            "computed_at": datetime.now(timezone.utc),
            "ttl": 300
        })
        
        print(f"   ✅ {email:<40} | Opps: {len(opps):<3} | Manager: {len(subordinates) > 0}")
    
    # STEP 6: Build dashboard metrics
    print("\nStep 6: Building dashboard metrics...")
    await db.dashboard_metrics.delete_many({})
    
    for profile in all_profiles:
        user_id = profile['id']
        
        access = await db.user_access_matrix.find_one({"user_id": user_id})
        accessible_ids = access.get('accessible_opportunities', [])
        
        opps = await db.opportunity_view.find({
            "odoo_id": {"$in": accessible_ids},
            "is_active": True
        }).to_list(10000)
        
        active = [o for o in opps if o.get('stage') not in ['Won', 'Lost', 'Closed Won', 'Closed Lost']]
        won = [o for o in opps if o.get('stage') in ['Won', 'Closed Won']]
        
        await db.dashboard_metrics.insert_one({
            "user_id": user_id,
            "pipeline_value": sum(o.get('value', 0) for o in active),
            "won_revenue": sum(o.get('value', 0) for o in won),
            "active_opportunities": len(active),
            "total_opportunities": len(opps),
            "won_count": len(won),
            "by_stage": {},
            "computed_at": datetime.now(timezone.utc),
            "ttl": 300
        })
    
    print(f"   ✅ Created metrics for {len(all_profiles)} users")
    
    # STEP 7: Final validation
    print("\n" + "="*80)
    print("FINAL VALIDATION")
    print("="*80)
    
    vinsha = await db.user_profiles.find_one({"email": "vinsha.nair@securado.net"})
    if vinsha:
        print(f"\n✅ Vinsha Profile:")
        print(f"   UUID (auth-compatible): {vinsha['id']}")
        print(f"   odoo.user_id: {vinsha['odoo']['user_id']}")
        print(f"   odoo.employee_id: {vinsha['odoo']['employee_id']}")
        print(f"   Subordinates: {len(vinsha['hierarchy']['subordinates'])}")
        for sub in vinsha['hierarchy']['subordinates']:
            print(f"      - {sub['name']} ({sub['email']})")
        
        access = await db.user_access_matrix.find_one({"user_id": vinsha['id']})
        if access:
            print(f"   Accessible Opps: {len(access.get('accessible_opportunities', []))}")
        
        # Check actual opportunities
        opps = await db.opportunity_view.find({
            "visible_to_user_ids": vinsha['id'],
            "is_active": True
        }).to_list(100)
        
        print(f"\n✅ Opportunities visible to Vinsha: {len(opps)}")
        for opp in opps:
            sp = opp.get('salesperson', {})
            sp_name = sp.get('name', 'Unassigned') if sp else 'Unassigned'
            print(f"      - {opp.get('name')[:50]} | SP: {sp_name}")
    
    print("\n✅ CQRS SETUP COMPLETE!")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(complete_cqrs_setup())
